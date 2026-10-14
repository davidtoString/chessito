import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
process.loadEnvFile('.env');
const origin=`http://127.0.0.1:${process.env.CHESSITO_PORT||3000}`;
const headers={Authorization:'Basic '+Buffer.from(`${process.env.CHESSITO_USERNAME||'david'}:${process.env.CHESSITO_PASSWORD}`).toString('base64'),'Content-Type':'application/json',Origin:origin};
async function ready(){for(let i=0;i<90;i++){try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error('Docker app did not become ready.');}
async function request(method,path,data,extra={}){const r=await fetch(origin+path,{method,headers:{...headers,...extra},body:data?JSON.stringify(data):undefined});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b;}
function docker(args){const distro=process.env.CHESSITO_WSL_DISTRO;const root=process.cwd().replace(/^([A-Za-z]):/,(_,drive)=>"/mnt/"+drive.toLowerCase()).replaceAll("\\","/");return distro?spawnSync("wsl.exe",["-d",distro,"--cd",root,"--exec","docker",...args],{encoding:"utf8"}):spawnSync("docker",args,{encoding:"utf8"});}
function containerFile(file){const r=docker(['compose','exec','-T','chessito','cat',file]);assert.equal(r.status,0);return r.stdout;}
await ready();
assert.equal((await fetch(origin+'/api/data')).status,401);
assert.equal((await fetch(origin+'/api/data',{headers:{Authorization:'Basic '+Buffer.from('david:wrong-password').toString('base64')}})).status,401);
const initial=await request('GET','/api/data');assert.equal(initial.settings.hasKey,false,'Use a Docker test account with no real API key.');
const loginPage=await fetch(origin+'/');assert.equal(loginPage.status,200);assert.match(await loginPage.text(),/Sign in &amp; play/);
const rejectedLogin=await fetch(origin+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'username=david&password=incorrect',redirect:'manual'});assert.equal(rejectedLogin.status,401);
const login=await fetch(origin+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:process.env.CHESSITO_USERNAME||'david',password:process.env.CHESSITO_PASSWORD}).toString(),redirect:'manual'});assert.equal(login.status,303);
const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);assert.match(login.headers.get('set-cookie'),/HttpOnly/);
const cookieHome=await fetch(origin+'/',{headers:{Cookie:cookie}});assert.equal(cookieHome.status,200);assert.match(await cookieHome.text(),/Play Pip/);
assert.equal((await fetch(origin+'/api/data',{headers:{Cookie:'chessito_session=9999999999999.invalid'}})).status,401);
const testId='docker-smoke-'+crypto.randomUUID();
const fakeKey='docker-test-key-not-real';
try{
 const home=await fetch(origin+'/',{headers});assert.equal(home.status,200);assert.match(await home.text(),/Play Pip/);
 assert.equal((await fetch(origin+'/engine/stockfish.wasm',{headers})).status,200);
 await request('POST','/api/data',{type:'game',game:{id:testId,pgn:'1. e4 e5 *',title:'Docker persistence test',createdAt:new Date().toISOString(),result:'*',source:'played',color:'w',bot:0,engine:'stockfish',review:[]}});
 await request('POST','/api/data',{type:'settings',settings:{provider:'gemini',model:'test-model',apiKey:fakeKey,autoCoach:false}});
 const before=await request('GET','/api/data');assert.ok(before.games.some(g=>g.id===testId));assert.ok(before.settings.hasKey);assert.ok(!JSON.stringify(before).includes(fakeKey));
 const keyBefore=containerFile('/data/encryption-key');
 const restart=docker(['compose','restart','chessito']);assert.equal(restart.status,0);await ready();
 const after=await request('GET','/api/data');assert.ok(after.games.some(g=>g.id===testId));assert.ok(after.settings.hasKey);assert.equal(containerFile('/data/encryption-key'),keyBefore);
 assert.equal((await fetch(origin+'/api/data',{headers:{Cookie:cookie}})).status,200);
 assert.match(keyBefore.trim(),/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(after).includes(keyBefore.trim()));
 const badOrigin=await fetch(origin+'/api/data',{method:'POST',headers:{...headers,Origin:'https://other.example'},body:'{}'});assert.equal(badOrigin.status,403);
 console.log('PASS: visible sign-in page, password validation, signed session cookie, homepage, engine assets, encrypted settings, persisted games/key/session after restart, and cross-origin denial. No provider calls.');
}finally{
 await request('DELETE','/api/data',{id:testId});
 await request('POST','/api/data',{type:'settings',settings:{...initial.settings,clearKey:true}});
}
