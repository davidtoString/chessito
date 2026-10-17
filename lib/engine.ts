import { Chess } from 'chess.js';
import { terminalEval, type Evaluation } from './chess';
export type EngineLine = { multipv: number; depth: number; cp: number; mate?: number; pv: string[] };
export class Engine {
 private worker: Worker | null=null;
 private ready: Promise<void> | null=null;
 private queue: Promise<unknown>=Promise.resolve();
 private listener: ((line:string)=>void) | null=null;
 private failed: ((e:Error)=>void) | null=null;
 private cache=new Map<string,Evaluation>();
 init() {
  if(this.ready)return this.ready;
  this.ready=new Promise<void>((resolve,reject)=>{
   const timeout=setTimeout(()=>{this.destroy();reject(new Error('Stockfish took too long to load. Reload the app to try again.'));},25000);
   this.worker=new Worker('/engine/stockfish.js');
   this.worker.onerror=()=>{clearTimeout(timeout);const e=new Error('Stockfish could not start. Reload the app and try again.');this.failed?.(e);reject(e);};
   this.worker.onmessage=(e)=>{for(const line of String(e.data).split('\n')){if(line==='uciok'){this.worker?.postMessage('setoption name Hash value 16');this.worker?.postMessage('isready');}if(line==='readyok'){clearTimeout(timeout);resolve();}this.listener?.(line);}};
   this.worker.postMessage('uci');
  });return this.ready;
 }
 evaluate(fen:string, depth=12, skill=20, ms=1200):Promise<Evaluation> {
  const key=fen+'|'+depth; if(skill===20&&this.cache.has(key))return Promise.resolve(this.cache.get(key)!);
  const terminal=terminalEval(new Chess(fen));if(terminal)return Promise.resolve(terminal);
  const job=this.queue.then(async()=>{await this.init();return new Promise<Evaluation>((resolve,reject)=>{
   const white=new Chess(fen).turn()==='w';let result:Evaluation={cp:0,best:'',depth:0};
   const timer=setTimeout(()=>{this.destroy();reject(new Error('Engine analysis timed out. Reload the app to restart the engine.'));},30000);
   this.failed=(e)=>{clearTimeout(timer);this.listener=null;reject(e);};
   this.listener=(line)=>{
    const score=line.match(/\bscore (cp|mate) (-?\d+)/);const d=line.match(/\bdepth (\d+)/);
    if(score&&!/upperbound|lowerbound/.test(line)){const n=Number(score[2]);result={...result,cp:(score[1]==='mate'?(n<0?-10000:10000):n)*(white?1:-1),mate:score[1]==='mate'?n*(white?1:-1):undefined,depth:d?Number(d[1]):result.depth};}
    if(line.startsWith('bestmove ')){clearTimeout(timer);this.listener=null;this.failed=null;result.best=line.split(' ')[1];if(skill===20){this.cache.set(key,result);if(this.cache.size>2048)this.cache.delete(this.cache.keys().next().value!);}resolve(result);}
   };
   this.worker!.postMessage('setoption name UCI_LimitStrength value false');
   this.worker!.postMessage('setoption name MultiPV value 1');
   this.worker!.postMessage(`setoption name Skill Level value ${skill}`);
   this.worker!.postMessage(`position fen ${fen}`);
   this.worker!.postMessage(`go depth ${depth} movetime ${ms}`);
  });});this.queue=job.catch(()=>{});return job;
 }
 // One move for a bot. `elo` uses the engine's own strength limiter (it supports 1320 and up); otherwise `skill` applies.
 // Returns the move and, with multipv > 1, the candidate lines (scores from White's side).
 think(fen:string, o:{elo?:number;skill?:number;multipv?:number;depth?:number;ms?:number}):Promise<{best:string;lines:EngineLine[]}> {
  const multipv=o.multipv??1,ms=o.ms??1000;
  if(terminalEval(new Chess(fen)))return Promise.resolve({best:'',lines:[]});
  const job=this.queue.then(async()=>{await this.init();return new Promise<{best:string;lines:EngineLine[]}>((resolve,reject)=>{
   const white=new Chess(fen).turn()==='w';const lines:EngineLine[]=[];
   const timer=setTimeout(()=>{this.destroy();reject(new Error('The bot took too long to move. Reload the app to restart the engine.'));},30000);
   this.failed=(e)=>{clearTimeout(timer);this.listener=null;reject(e);};
   this.listener=(line)=>{
    const m=line.match(/^info .*?\bdepth (\d+) .*?\bmultipv (\d+) .*?\bscore (cp|mate) (-?\d+).*? pv (.+)$/);
    if(m&&!/upperbound|lowerbound/.test(line)){const n=Number(m[4]);lines[Number(m[2])-1]={multipv:Number(m[2]),depth:Number(m[1]),cp:(m[3]==='mate'?(n<0?-10000:10000):n)*(white?1:-1),mate:m[3]==='mate'?n*(white?1:-1):undefined,pv:m[5].trim().split(' ')};}
    if(line.startsWith('bestmove ')){clearTimeout(timer);this.listener=null;this.failed=null;this.worker?.postMessage('setoption name UCI_LimitStrength value false');resolve({best:line.split(' ')[1],lines:lines.filter(Boolean)});}
   };
   const w=this.worker!;
   w.postMessage(`setoption name MultiPV value ${multipv}`);
   if(o.elo!==undefined){w.postMessage('setoption name UCI_LimitStrength value true');w.postMessage(`setoption name UCI_Elo value ${Math.min(3190,Math.max(1320,Math.round(o.elo)))}`);}
   else{w.postMessage('setoption name UCI_LimitStrength value false');w.postMessage(`setoption name Skill Level value ${o.skill??20}`);}
   w.postMessage(`position fen ${fen}`);
   w.postMessage(`go depth ${o.depth??40} movetime ${ms}`);
  });});this.queue=job.catch(()=>{});return job;
 }
 // Streams the top `multipv` lines until `depth`, or until stop() is called. Scores are from White's side.
 analyzeLines(fen:string, multipv:number, depth:number, onUpdate:(lines:EngineLine[])=>void):{stop:()=>void;done:Promise<void>} {
  let stopped=false;let halt=()=>{};
  const job=this.queue.then(async()=>{if(stopped)return;await this.init();if(stopped)return;return new Promise<void>(resolve=>{
   const white=new Chess(fen).turn()==='w';const lines:EngineLine[]=[];
   halt=()=>this.worker?.postMessage('stop');
   this.failed=()=>{this.listener=null;resolve();};
   this.listener=(line)=>{
    const m=line.match(/^info .*?\bdepth (\d+) .*?\bmultipv (\d+) .*?\bscore (cp|mate) (-?\d+).*? pv (.+)$/);
    if(m&&!/upperbound|lowerbound/.test(line)){const n=Number(m[4]);lines[Number(m[2])-1]={multipv:Number(m[2]),depth:Number(m[1]),cp:(m[3]==='mate'?(n<0?-10000:10000):n)*(white?1:-1),mate:m[3]==='mate'?n*(white?1:-1):undefined,pv:m[5].trim().split(' ')};onUpdate(lines.filter(Boolean));}
    if(line.startsWith('bestmove ')){this.listener=null;this.failed=null;resolve();}
   };
   this.worker!.postMessage('setoption name UCI_LimitStrength value false');
   this.worker!.postMessage('setoption name Skill Level value 20');
   this.worker!.postMessage(`setoption name MultiPV value ${multipv}`);
   this.worker!.postMessage(`position fen ${fen}`);
   this.worker!.postMessage(`go depth ${depth}`);
  });});
  this.queue=job.catch(()=>{});
  return {stop:()=>{stopped=true;halt();},done:job.catch(()=>{})};
 }
 destroy(){this.worker?.terminate();this.worker=null;this.ready=null;}
}
