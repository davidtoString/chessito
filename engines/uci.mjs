import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';
export const catalog=[
 {id:'maia',name:'Maia',description:'Human-like moves using Maia 1100, 1500, or 1900 models. Training ratings are not guaranteed bot Elo.',path:'/opt/lc0/lc0',family:'maia'},
 {id:'lc0',name:'Leela Chess Zero',description:'Neural search with the T1 256×10 distilled network. CPU mode; search strength is approximate.',path:'/opt/lc0/lc0',family:'lc0'},
 {id:'arasan',name:'Arasan 25.2',description:'A different native chess engine, running on your Docker host.',path:'/opt/arasan/arasan',family:'arasan'},
 {id:'fairy',name:'Fairy-Stockfish 11.1',description:'Plays standard chess here. Variant rules and boards are not yet supported by this app.',path:'/usr/games/fairy-stockfish',family:'fairy'},
];
export function makePosition(input){
 if(typeof input.fen!=='string'||input.fen.length>150||/[\r\n]/.test(input.fen))throw new Error('Invalid FEN.');
 const board=new Chess(input.fen);
 if(!Number.isInteger(input.level)||input.level<0||input.level>3)throw new Error('Invalid difficulty.');
 if(input.startFen!==undefined){
  if(typeof input.startFen!=='string'||input.startFen.length>150||/[\r\n]/.test(input.startFen)||!Array.isArray(input.moves)||input.moves.length>1000)throw new Error('Invalid move history.');
  const history=new Chess(input.startFen);for(const uci of input.moves){if(typeof uci!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))throw new Error('Invalid move history.');history.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});}
  if(history.fen()!==board.fen())throw new Error('Move history does not match the position.');
  return {board,command:`position fen ${input.startFen}${input.moves.length?' moves '+input.moves.join(' '):''}`};
 }
 return {board,command:'position fen '+input.fen};
}
export function runUci(config,input=null){return new Promise((resolve,reject)=>{
 const level=input?.level??0;const ratings=[1100,1100,1500,1900];
 const args=config.family==='maia'?['--backend=blas',`--weights=/models/maia-${ratings[level]}.pb.gz`,'--threads=1','--minibatch-size=1']:config.family==='lc0'?['--backend=blas','--weights=/models/leela.pb.gz','--threads=1','--minibatch-size=1']:[];
 const child=spawn(config.path,args,{cwd:config.family==='arasan'?'/opt/arasan':'/service',stdio:['pipe','pipe','pipe'],env:{PATH:process.env.PATH,HOME:'/home/node',OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1'}});
 let text='',stderr='',done=false,phase='uci',name=config.name;
 const timer=setTimeout(()=>finish(new Error(config.name+' timed out.')),input?45000:10000);
 function finish(error,result){if(done)return;done=true;clearTimeout(timer);child.kill('SIGKILL');error?reject(error):resolve(result);}
 function send(command){if(!done&&child.stdin.writable)child.stdin.write(command+'\n');}
 child.on('error',()=>finish(new Error(config.name+' could not start.')));
 child.on('exit',()=>{if(!done)finish(new Error(config.name+' exited before returning a move. '+stderr.slice(-500)));});
 child.stdin.on('error',()=>{});child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-2000);});
 child.stdout.on('data',b=>{text+=b.toString();if(text.length>1000000){finish(new Error('Engine output exceeded its limit.'));return;}let newline;while((newline=text.indexOf('\n'))>=0){const line=text.slice(0,newline).trim();text=text.slice(newline+1);
  if(line.startsWith('id name '))name=line.slice(8);
  if(line==='uciok'&&phase==='uci'){
   if(!input){finish(null,{name});return;}phase='ready';
   if(config.family==='arasan'){send('setoption name Hash value 32');send('setoption name Threads value 1');send('setoption name OwnBook value false');send('setoption name UCI_LimitStrength value true');send(`setoption name UCI_Elo value ${[1000,1100,1500,2000][level]}`);}
   if(config.family==='fairy'){send('setoption name UCI_Variant value chess');send('setoption name Threads value 1');send('setoption name Hash value 32');send(`setoption name Skill Level value ${[0,3,8,18][level]}`);}
   send('ucinewgame');send('isready');
  }
  if(line==='readyok'&&phase==='ready'){phase='search';send(makePosition(input).command);send(config.family==='maia'?'go nodes 1':config.family==='lc0'?`go nodes ${[8,24,64,128][level]}`:`go movetime ${[150,300,600,1000][level]}`);}
  if(line.startsWith('bestmove ')&&phase==='search'){const move=line.split(/\s+/)[1];finish(null,{move,engineName:name});}
 }});
 send('uci');
});}
