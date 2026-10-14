import http from 'node:http';
import { catalog, makePosition, runUci } from './uci.mjs';
const available=[];
for(const engine of catalog){try{const identity=await runUci(engine);available.push({...engine,available:true,version:identity.name});}catch(e){available.push({...engine,available:false,error:e.message});}}
let active=0;
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
http.createServer(async(req,res)=>{
 if(req.url==='/healthz'){json(res,200,{ok:true});return;}
 if(req.url==='/engines'&&req.method==='GET'){json(res,200,{engines:available.map(({path,family,...e})=>e)});return;}
 if(req.url!=='/move'||req.method!=='POST'){json(res,404,{error:'Unknown engine endpoint.'});return;}
 if(active>=2){json(res,429,{error:'The engine service is busy. Try again in a moment.'});return;}
 let input,position,engine;
 try{let text='';for await(const chunk of req){text+=chunk.toString();if(text.length>16000)throw new Error('Request is too large.');}input=JSON.parse(text);engine=available.find(e=>e.id===input.engine);if(!engine)throw new Error('Unknown engine.');if(!engine.available){json(res,503,{error:engine.error});return;}position=makePosition(input);}catch(e){json(res,400,{error:e.message});return;}
 if(!position.board.moves().length){json(res,400,{error:'The position has no legal moves.'});return;}
 if(active>=2){json(res,429,{error:'The engine service is busy. Try again in a moment.'});return;}
 active++;
 try{const result=await runUci(engine,input);const move=position.board.move({from:result.move.slice(0,2),to:result.move.slice(2,4),promotion:result.move[4]});if(!move)throw new Error('The engine returned an illegal move.');json(res,200,result);}catch(e){json(res,502,{error:e.message});}finally{active--;}
}).listen(8000,'0.0.0.0',()=>console.log('Chessito engines ready: '+available.filter(e=>e.available).map(e=>e.version).join(', ')));
