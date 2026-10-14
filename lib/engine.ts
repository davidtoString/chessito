import { Chess } from 'chess.js';
import { terminalEval, type Evaluation } from './chess';
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
 evaluate(fen:string, depth=12, skill=20):Promise<Evaluation> {
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
   this.worker!.postMessage(`setoption name Skill Level value ${skill}`);
   this.worker!.postMessage(`position fen ${fen}`);
   this.worker!.postMessage(`go depth ${depth} movetime 1200`);
  });});this.queue=job.catch(()=>{});return job;
 }
 destroy(){this.worker?.terminate();this.worker=null;this.ready=null;}
}
