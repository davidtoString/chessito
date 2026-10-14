import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:3100';const username=process.env.TEST_USERNAME||'test-owner';const password=process.env.TEST_PASSWORD||'Chessito-local-test-credential-2026';
const headers={'Content-Type':'application/json',Origin:origin,Authorization:'Basic '+Buffer.from(username+':'+password).toString('base64')};
assert.equal((await fetch(origin+'/api/data')).status,401);
const login=await fetch(origin+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password}),redirect:'manual'});assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);
const home=await fetch(origin+'/',{headers:{Cookie:cookie}});const html=await home.text();assert.equal(home.status,200);assert.match(html,/Play Pip/);assert.match(home.headers.get('content-security-policy'),/nonce-/);const nonce=home.headers.get('content-security-policy').match(/nonce-([^']+)/)[1];assert.ok(html.includes('nonce="'+nonce+'"'));assert.equal(home.headers.get('x-content-type-options'),'nosniff');assert.equal(home.headers.get('x-powered-by'),null);
for(const file of ['/manifest.webmanifest','/sw.js','/offline.html','/icons/icon-192.png','/icons/icon-512.png'])assert.equal((await fetch(origin+file)).status,200,file);
const manifest=await (await fetch(origin+'/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');assert.equal(manifest.icons.length,2);assert.ok(!readFileSync('public/sw.js','utf8').includes("cache.put"));
async function post(game){return fetch(origin+'/api/data',{method:'POST',headers,body:JSON.stringify({type:'game',game})});}
const id='production-test-'+crypto.randomUUID();let stored;
try{const game={id,title:'Production conflict test',pgn:'1. e4 e5 *',createdAt:new Date().toISOString(),source:'played',color:'w',bot:0,engine:'stockfish',review:[],result:'*',revision:0};const first=await post(game);assert.equal(first.status,200);const saved=await first.json();assert.equal(saved.revision,1);assert.equal((await post({...game,pgn:'1. d4 d5 *'})).status,409);
 const read=await (await fetch(origin+'/api/data',{headers})).json();stored=read.games.find(g=>g.id===id);assert.equal(stored.pgn,game.pgn);
 const update=await post({...game,revision:1,pgn:'1. e4 e5 2. Nf3 *'});assert.equal(update.status,200);assert.equal((await update.json()).revision,2);
 const malformed=await fetch(origin+'/api/data',{method:'POST',headers,body:'not-json'});assert.equal(malformed.status,400);
 const spoof=await fetch(origin+'/api/data',{method:'POST',headers:{...headers,Origin:'https://untrusted.example'},body:'{}'});assert.equal(spoof.status,403);
 const missingOrigin=await fetch(origin+'/api/data',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(missingOrigin.status,403);
 const exit=await fetch(origin+'/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin},redirect:'manual'});assert.equal(exit.status,303);assert.match(exit.headers.get('set-cookie'),/Max-Age=0/);
 console.log('PASS production login, CSP nonces, headers, PWA assets, revision conflicts, malformed JSON, origin protection, and logout.');
}finally{await fetch(origin+'/api/data',{method:'DELETE',headers,body:JSON.stringify({id})});}
