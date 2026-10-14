import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual, createHmac, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import { initializeDatabase } from './database.mjs';
const username=process.env.CHESSITO_USERNAME||'david';
if(!/^[A-Za-z0-9_.-]{1,64}$/.test(username))throw new Error('Use a username with 1–64 letters, digits, dots, underscores, or hyphens.');
const password=process.env.CHESSITO_PASSWORD;
if(!password||password.length<16)throw new Error('Set CHESSITO_PASSWORD to a password with at least 16 characters.');
const expected=Buffer.from(`${username}:${password}`);
const publicOrigin=process.env.CHESSITO_PUBLIC_ORIGIN?new URL(process.env.CHESSITO_PUBLIC_ORIGIN).origin:null;
const dataRoot=process.env.CHESSITO_DATA_DIR||'/data';mkdirSync(dataRoot,{recursive:true});
const keyFile=path.join(dataRoot,'encryption-key');
if(!existsSync(keyFile))writeFileSync(keyFile,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
const encryptionKey=readFileSync(keyFile,'utf8').trim();
if(!/^[a-f0-9]{64}$/.test(encryptionKey))throw new Error('Stored encryption key is invalid.');
initializeDatabase().close();
const internalPort=Number(process.env.CHESSITO_SERVER_PORT||8787);const internalOrigin='http://127.0.0.1:'+internalPort;
const env={...process.env,PORT:String(internalPort),HOSTNAME:'127.0.0.1',COACH_ENCRYPTION_KEY:encryptionKey};
delete env.CHESSITO_PASSWORD;
const worker=spawn(process.execPath,[process.env.CHESSITO_SERVER_PATH||path.resolve('server.js')],{env,stdio:['ignore','pipe','pipe']});
worker.stdout.resume();
worker.stderr.on('data',()=>console.error('Application server reported an error; check the request status. Secret-bearing output is suppressed.'));
let stopping=false;
worker.on('error',()=>{console.error('Worker could not start.');process.exit(1);});
worker.on('exit',code=>{if(!stopping){console.error('Worker stopped.');process.exit(code||1);}});
let ready=false;
for(let i=0;i<120;i++){try{const health=await fetch(internalOrigin+'/api/health',{signal:AbortSignal.timeout(1000)});if(health.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
if(!ready){worker.kill();throw new Error('Worker did not become ready.');}
function same(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function sign(value){return createHmac('sha256',encryptionKey).update(password).update(value).digest('hex');}
function authenticated(req){
 const h=req.headers.authorization||'';if(h.startsWith('Basic ')){const actual=Buffer.from(h.slice(6),'base64');if(actual.length===expected.length&&timingSafeEqual(actual,expected))return true;}
 const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('chessito_session='))?.slice(17);
 if(!cookie)return false;const [expiry,signature]=cookie.split('.');return /^\d+$/.test(expiry)&&Number(expiry)>Date.now()&&!!signature&&same(signature,sign(expiry));
}
function loginPage(error=''){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Chessito</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f0f2eb;color:#263d33;font-family:system-ui}main{box-sizing:border-box;width:min(420px,calc(100% - 36px));background:white;border:1px solid #e1e6da;border-radius:14px;padding:35px}h1{font:36px Georgia;margin:0 0 12px}p{font-size:14px;color:#7a837a;line-height:1.6}label{display:block;margin-top:20px;font-size:13px}input{box-sizing:border-box;width:100%;padding:12px;margin-top:8px;border:1px solid #dce2d4;border-radius:6px;font:inherit}button{width:100%;padding:13px;margin-top:25px;border:0;border-radius:6px;background:#40694f;color:white;font:inherit;cursor:pointer}.error{color:#a45638}</style></head><body><main><h1>♞ chessito.</h1><p>Welcome to your private practice room.</p>${error?'<p role="alert" class="error">'+error+'</p>':''}<form method="post" action="/login"><label>Username<input name="username" autocomplete="username" required autofocus></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Sign in &amp; play</button></form><p>Your login details are in the project's private .env file.</p></main></body></html>`;}
const attempts=new Map();const usage=new Map();
setInterval(()=>{for(const [key,value] of attempts)if(Date.now()-value.time>120000)attempts.delete(key);for(const [key,value] of usage)if(Date.now()-value.time>120000)usage.delete(key);},60000).unref();
async function handle(req,res){
 const nonce=randomBytes(18).toString('base64');const requestId=randomUUID();const started=Date.now();
 const csp=`default-src 'self'; script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
 res.setHeader('Content-Security-Policy',csp);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('X-Request-Id',requestId);
 if(publicOrigin?.startsWith('https:'))res.setHeader('Strict-Transport-Security','max-age=31536000');
 res.on('finish',()=>{if(res.statusCode>=400||req.method!=='GET')console.log(JSON.stringify({requestId,method:req.method,path:(req.url||'/').split('?')[0],status:res.statusCode,ms:Date.now()-started}));});
 if(req.url==='/healthz'){
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let healthy=false;try{healthy=(await fetch(internalOrigin+'/api/health',{signal:AbortSignal.timeout(2000)})).ok;}catch{}
  res.writeHead(healthy?200:503,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end(req.method==='HEAD'?'':healthy?'ok':'unavailable');return;
 }
 if(publicOrigin&&req.headers.host!==new URL(publicOrigin).host){res.writeHead(421);res.end('Use the configured Chessito address.');return;}
 if(['/manifest.webmanifest','/sw.js','/offline.html','/icons/icon-192.png','/icons/icon-512.png'].includes(req.url)&&req.method==='GET'){
  try{const bytes=readFileSync(path.join('public',req.url));const type=req.url.endsWith('.png')?'image/png':req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.webmanifest')?'application/manifest+json':'text/html';res.writeHead(200,{'Content-Type':type,'Cache-Control':req.url==='/sw.js'?'no-store':'public, max-age=3600','Service-Worker-Allowed':'/'});res.end(bytes);}catch{res.writeHead(404);res.end();}return;
 }
 const origin=publicOrigin||`http://${req.headers.host}`;
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);res.end('Request origin is not allowed.');return;}
 if(req.url==='/login'){
  if(req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(loginPage());return;}
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  const ip=req.socket.remoteAddress;const attempt=attempts.get(ip);if(attempt&&attempt.count>=10&&Date.now()-attempt.time<60000){res.writeHead(429,{'Retry-After':'60','Content-Type':'text/html'});res.end(loginPage('Too many attempts. Try again in a minute.'));return;}
  let text='';for await(const chunk of req){text+=chunk.toString();if(text.length>4096){res.writeHead(413);res.end();return;}}
  const fields=new URLSearchParams(text);
  if(!same(`${fields.get('username')||''}:${fields.get('password')||''}`,expected)){
   if(attempts.size>=1024&&!attempts.has(ip))attempts.delete(attempts.keys().next().value);attempts.set(ip,{time:Date.now(),count:attempt&&Date.now()-attempt.time<60000?attempt.count+1:1});res.writeHead(401,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(loginPage('Incorrect username or password.'));return;
  }
  attempts.delete(ip);const expiry=String(Date.now()+30*24*60*60*1000);
  res.writeHead(303,{Location:'/','Cache-Control':'no-store','Set-Cookie':`chessito_session=${expiry}.${sign(expiry)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${origin.startsWith('https:')?'; Secure':''}`});res.end();return;
 }
 if(!authenticated(req)){if(req.url?.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Please sign in again.'}));}else{res.writeHead(303,{Location:'/login','Cache-Control':'no-store'});res.end();}return;}
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!req.headers.authorization&&!req.headers.origin){res.writeHead(403);res.end('An Origin header is required.');return;}
 if(req.url==='/logout'&&req.method==='POST'){res.writeHead(303,{Location:'/login','Cache-Control':'no-store','Set-Cookie':`chessito_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${publicOrigin?.startsWith('https:')?'; Secure':''}`});res.end();return;}
 if(req.method==='POST'&&['/api/coach','/api/engines/move'].includes(req.url)){
  const key=req.url;let counter=usage.get(key);if(!counter||Date.now()-counter.time>60000){counter={time:Date.now(),count:0};usage.set(key,counter);}if(++counter.count>(key==='/api/coach'?12:60)){res.writeHead(429,{'Content-Type':'application/json','Retry-After':'60'});res.end(JSON.stringify({error:'Too many coaching or engine requests. Try again in a minute.'}));return;}
 }
 if(!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);res.end('Invalid request path.');return;}
 if(req.url==='/api/engines'||req.url==='/api/engines/move'){
  const isMove=req.url.endsWith('/move');
  if(req.method!==(isMove?'POST':'GET')){res.writeHead(405);res.end();return;}
  try{
   let body='';if(isMove)for await(const chunk of req){body+=chunk.toString();if(body.length>16000){res.writeHead(413);res.end();return;}}
   const base=process.env.CHESSITO_ENGINE_SERVICE;if(!base)throw new Error('Engine service is not configured.');
   const response=await fetch(base+(isMove?'/move':'/engines'),{method:req.method,headers:{'Content-Type':'application/json'},body:isMove?body:undefined,signal:AbortSignal.timeout(50000)});
   res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(await response.text());
  }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Native engines are unavailable. Check the engines container or select browser Stockfish.'}));}return;
 }
 const headers={...req.headers};
 for(const name of Object.keys(headers))if(name.startsWith('oai-')||name.startsWith('x-forwarded-')||['forwarded','authorization','connection','host','transfer-encoding','content-length','accept-encoding'].includes(name))delete headers[name];
 headers['oai-authenticated-user-id']='docker-owner';
 headers['oai-authenticated-user-email']='owner@chessito.local';
 headers['oai-authenticated-user-full-name']=username;
 headers['content-security-policy']=csp;headers['x-nonce']=nonce;
 // Next normalizes loopback request URLs to localhost, even when fetched at 127.0.0.1.
 // The public Origin has already been checked above; match Next's internal URL here.
 if(headers.origin)headers.origin=`http://localhost:${internalPort}`;
 try{
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1500000){res.writeHead(413);res.end('Request too large.');return;}chunks.push(chunk);}
  const response=await fetch(`${internalOrigin}${req.url}`,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined,redirect:'manual',signal:AbortSignal.timeout(60000)});
  const responseHeaders={};for(const [name,value] of response.headers)if(!['content-encoding','content-length','transfer-encoding','connection'].includes(name))responseHeaders[name]=value;
  responseHeaders['X-Content-Type-Options']='nosniff';responseHeaders['Referrer-Policy']='same-origin';
  res.writeHead(response.status,responseHeaders);if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end();
 }catch{if(!res.headersSent)res.writeHead(502);res.end('Chessito is temporarily unavailable.');}
}
const server=http.createServer((req,res)=>{void handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});if(!res.destroyed)res.end(JSON.stringify({error:'The request could not be completed.'}));});});
server.requestTimeout=65000;server.headersTimeout=15000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;
const listenPort=Number(process.env.CHESSITO_LISTEN_PORT||3000);
server.listen(listenPort,process.env.CHESSITO_BIND_IP||'0.0.0.0',()=>console.log(`Chessito production server ready on port ${listenPort}. Login credentials are in your private .env file.`));
function stop(){if(stopping)return;stopping=true;server.close();worker.kill('SIGTERM');setTimeout(()=>process.exit(0),3000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
