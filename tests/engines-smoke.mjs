import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
process.loadEnvFile('.env');
const origin=`http://127.0.0.1:${process.env.CHESSITO_PORT||3000}`;
const headers={Authorization:'Basic '+Buffer.from(`${process.env.CHESSITO_USERNAME||'david'}:${process.env.CHESSITO_PASSWORD}`).toString('base64'),'Content-Type':'application/json',Origin:origin};
assert.equal((await fetch(origin+'/api/engines')).status,401);
const response=await fetch(origin+'/api/engines',{headers});assert.equal(response.status,200);const {engines}=await response.json();assert.equal(engines.length,4);
for(const engine of engines){
 assert.equal(engine.available,true,engine.name+': '+engine.error);
 const c=new Chess();const startFen=c.fen();c.move('e4');
 const r=await fetch(origin+'/api/engines/move',{method:'POST',headers,body:JSON.stringify({engine:engine.id,fen:c.fen(),startFen,moves:['e2e4'],level:0})});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));assert.ok(c.move({from:data.move.slice(0,2),to:data.move.slice(2,4),promotion:data.move[4]}));console.log('PASS '+engine.name+': legal reply '+data.move+' ('+data.engineName+')');
}
const bad=await fetch(origin+'/api/engines/move',{method:'POST',headers,body:JSON.stringify({engine:'../../bin/sh',fen:new Chess().fen(),level:0})});assert.equal(bad.status,400);
const injection=await fetch(origin+'/api/engines/move',{method:'POST',headers,body:JSON.stringify({engine:'maia',fen:new Chess().fen()+'\nquit',level:0})});assert.equal(injection.status,400);
console.log('PASS authentication, engine allowlist, and command injection rejection. No saved games or provider settings modified.');
