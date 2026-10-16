import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import { initializeDatabase } from './database.mjs';
import * as auth from './auth.mjs';
import { mailConfig, sendMail, inviteEmail, resetEmail, verifyEmail } from './mail.mjs';

const publicOrigin=process.env.CHESSITO_PUBLIC_ORIGIN?new URL(process.env.CHESSITO_PUBLIC_ORIGIN).origin:null;
// Sign-up is by invite link only; set CHESSITO_SIGNUP=closed to stop new accounts entirely.
const signup=process.env.CHESSITO_SIGNUP==='closed'?'closed':'invite';
// Email (invites, password reset, address confirmation) is on only when Resend is configured.
const mail=mailConfig();
const dataRoot=process.env.CHESSITO_DATA_DIR||'/data';mkdirSync(dataRoot,{recursive:true});
const keyFile=path.join(dataRoot,'encryption-key');
if(!existsSync(keyFile))writeFileSync(keyFile,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
const encryptionKey=readFileSync(keyFile,'utf8').trim();
if(!/^[a-f0-9]{64}$/.test(encryptionKey))throw new Error('Stored encryption key is invalid.');
const db=initializeDatabase();
// First start: the credentials in .env become the owner account, which keeps all existing games and settings.
if(auth.userCount(db)===0){
 const username=process.env.CHESSITO_USERNAME||'david';
 if(!/^[A-Za-z0-9_.-]{1,64}$/.test(username))throw new Error('Use a username with 1–64 letters, digits, dots, underscores, or hyphens.');
 const password=process.env.CHESSITO_PASSWORD;
 if(!password||password.length<16)throw new Error('Set CHESSITO_PASSWORD to a password with at least 16 characters.');
 await auth.bootstrapOwner(db,username,password);console.log(`Owner account "${auth.normalizeUsername(username)}" created from .env. Change the password in Settings; later changes to CHESSITO_PASSWORD are ignored.`);
}
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

// ── helpers ────────────────────────────────────────────────────────────────
const loginByIp=new auth.Throttle({max:20}),loginByName=new auth.Throttle({max:5}),registerByIp=new auth.Throttle({max:10}),passwordByUser=new auth.Throttle({max:5}),resetByIp=new auth.Throttle({max:10}),forgotByIp=new auth.Throttle({max:5,windowMs:3600000,baseLockMs:600000}),forgotByUser=new auth.Throttle({max:3,windowMs:3600000,baseLockMs:3600000}),emailByUser=new auth.Throttle({max:3,windowMs:3600000,baseLockMs:3600000});
const usage=new Map();
setInterval(()=>{for(const [key,value] of usage)if(Date.now()-value.time>120000)usage.delete(key);for(const t of [loginByIp,loginByName,registerByIp,passwordByUser,resetByIp,forgotByIp,forgotByUser,emailByUser])t.sweep();try{auth.pruneSessions(db);auth.pruneTokens(db);}catch{}},60000).unref();
// Behind Traefik/Cloudflare every request arrives from the proxy, so read the visitor's address from the proxy header.
function clientIp(req){
 const peer=req.socket.remoteAddress||'';
 if(/^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:(127|10|192\.168|172\.(1[6-9]|2\d|3[01]))\.|f[cd])/i.test(peer)){
  const cf=req.headers['cf-connecting-ip'];if(typeof cf==='string'&&/^[0-9a-f:.]{3,45}$/i.test(cf))return cf;
  const xf=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();if(/^[0-9a-f:.]{3,45}$/i.test(xf))return xf;
 }
 return peer;
}
const secure=()=>publicOrigin?.startsWith('https:');
const cookieToken=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('chessito_session='))?.slice(17)||'';
const sessionCookie=(token,maxAge)=>`chessito_session=${token}; Path=/; HttpOnly; SameSite=Strict${maxAge===null?'':`; Max-Age=${maxAge}`}${secure()?'; Secure':''}`;
async function readText(req,limit){let text='';for await(const chunk of req){text+=chunk.toString();if(text.length>limit)throw new Error('too large');}return text;}
async function readJson(req,limit=8192){try{return JSON.parse(await readText(req,limit)||'{}');}catch{throw new Error('bad request');}}
function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}
const originOf=req=>publicOrigin||`http://${req.headers.host}`;
// Basic auth is kept for scripts and tests; browsers use the session cookie.
async function currentUser(req){
 const h=req.headers.authorization||'';
 if(h.startsWith('Basic ')){
  const text=Buffer.from(h.slice(6),'base64').toString();const i=text.indexOf(':');if(i<1)return null;
  const name=auth.normalizeUsername(text.slice(0,i));if(loginByName.wait('u:'+name))return null;
  const user=await auth.authenticate(db,name,text.slice(i+1));if(!user)loginByName.fail('u:'+name);else loginByName.reset('u:'+name);return user;
 }
 return auth.sessionUser(db,cookieToken(req));
}

// ── pages ──────────────────────────────────────────────────────────────────
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function shell(title,inner){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(title)} · Chessito</title><style>
@font-face{font-family:'Plus Jakarta Sans';src:url(/fonts/plus-jakarta-sans-latin-wght-normal.woff2) format('woff2');font-weight:200 800;font-display:swap}
@font-face{font-family:'Sora';src:url(/fonts/sora-latin-wght-normal.woff2) format('woff2');font-weight:100 800;font-display:swap}
:root{--bg:#f3f5fa;--card:#fff;--ink:#1f2937;--muted:#667085;--line:#e1e5ef;--accent:#5d8a2f;--accent-ink:#fff;--soft:#eaf3dc;--bad:#b42318;--badbg:#fdecea}
@media(prefers-color-scheme:dark){:root{--bg:#262421;--card:#302e2b;--ink:#f1f0ee;--muted:#b3b1ad;--line:#43413d;--accent:#81b64c;--accent-ink:#10200a;--soft:#34432a;--bad:#ffb4aa;--badbg:#3c2420}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:15px/1.5 'Plus Jakarta Sans',system-ui,sans-serif;padding:24px 0}
main{width:min(430px,calc(100% - 32px));background:var(--card);border:1px solid var(--line);border-radius:14px;padding:32px;box-shadow:0 12px 40px #0000001a}
.brand{font:800 30px/1 Sora,system-ui,sans-serif;letter-spacing:-.04em;margin:0 0 6px;color:var(--ink)}.brand i{color:var(--accent);font-style:normal}
h1{font:700 21px/1.3 Sora,system-ui,sans-serif;margin:18px 0 6px}p{color:var(--muted);margin:0 0 4px}
label{display:block;margin-top:16px;font-size:13px;font-weight:600}input{width:100%;margin-top:6px;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit}
input:focus{outline:2px solid var(--accent);outline-offset:1px}small{display:block;margin-top:4px;color:var(--muted);font-size:12px}
button{width:100%;margin-top:22px;padding:13px;border:0;border-radius:8px;background:var(--accent);color:var(--accent-ink);font:inherit;font-weight:700;cursor:pointer}
.check{display:flex;gap:10px;align-items:flex-start;font-weight:500;margin-top:18px}.check input{width:auto;margin:3px 0 0}.check small{margin-top:2px}.notice{margin-top:16px;padding:10px 12px;border-radius:8px;background:var(--soft);color:var(--ink);font-size:14px}
.error{margin-top:16px;padding:10px 12px;border-radius:8px;background:var(--badbg);color:var(--bad);font-size:14px}.note{margin-top:20px;font-size:13px;color:var(--muted);text-align:center}a{color:var(--accent)}
</style></head><body><main><p class="brand">chessito<i>.</i></p>${inner}</main></body></html>`;}
function loginPage(error='',username='',notice=''){return shell('Sign in',`<h1>Welcome back</h1><p>Sign in to your Chessito account.</p>${notice?`<div class="notice" role="status">${esc(notice)}</div>`:''}${error?`<div class="error" role="alert">${esc(error)}</div>`:''}<form method="post" action="/login"><label>Username<input name="username" value="${esc(username)}" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><label class="check"><input type="checkbox" name="remember" value="1" checked><span>Remember me on this device<small>Stay signed in for 30 days. Untick this on a shared computer.</small></span></label><button type="submit">Sign in</button></form>${mail?'<p class="note"><a href="/forgot">Forgot your password?</a></p>':''}<p class="note">${signup==='invite'?'New here? Ask the owner for an invite link.':'Sign-ups are closed.'}</p>`);}
function registerPage(f={}){return shell('Join',`<h1>Join Chessito</h1><p>You were invited${f.email?` as <b>${esc(f.email)}</b>`:''}. Choose a username and password.</p>${f.error?`<div class="error" role="alert">${esc(f.error)}</div>`:''}<form method="post" action="/register"><input type="hidden" name="invite" value="${esc(f.invite)}"><label>Username<input name="username" value="${esc(f.username)}" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="32" required autofocus><small>3–32 letters, digits, dots, underscores or hyphens.</small></label><label>Display name <span style="font-weight:400;color:var(--muted)">(optional)</span><input name="displayName" value="${esc(f.displayName)}" maxlength="40" autocomplete="nickname"></label><label>Password<input name="password" type="password" autocomplete="new-password" minlength="10" required><small>At least 10 characters.</small></label><label>Repeat password<input name="confirm" type="password" autocomplete="new-password" minlength="10" required></label><button type="submit">Create account</button></form><p class="note">Already have an account? <a href="/login">Sign in</a></p>`);}
const forgotPage=()=>mail?shell('Forgot password',`<h1>Forgot your password?</h1><p>Enter your username or email address. If it belongs to an account with a confirmed email, we will send a reset link.</p><form method="post" action="/forgot"><label>Username or email<input name="identifier" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></label><button type="submit">Send reset link</button></form><p class="note"><a href="/login">Back to sign in</a></p>`):shell('Forgot password',`<h1>Password reset by email is not set up</h1><p>Ask the owner to reset your password.</p><p class="note"><a href="/login">Back to sign in</a></p>`);
const forgotSentPage=()=>shell('Check your email',`<h1>Check your email</h1><p>If that matches an account with a confirmed email address, a reset link is on its way. It works for 1 hour.</p><p class="note"><a href="/login">Back to sign in</a></p>`);
const resetPage=(token,error='')=>shell('New password',`<h1>Choose a new password</h1>${error?`<div class="error" role="alert">${esc(error)}</div>`:''}<form method="post" action="/reset"><input type="hidden" name="token" value="${esc(token)}"><label>New password<input name="password" type="password" autocomplete="new-password" minlength="10" required autofocus><small>At least 10 characters.</small></label><label>Repeat new password<input name="confirm" type="password" autocomplete="new-password" minlength="10" required></label><button type="submit">Set new password</button></form>`);
const resetBadPage=()=>shell('Link expired',`<h1>This reset link does not work</h1><p>It may have expired or already been used. Request a new one.</p><p class="note">${mail?'<a href="/forgot">Request a new link</a> · ':''}<a href="/login">Sign in</a></p>`);
const confirmPage=token=>shell('Confirm email',`<h1>Confirm your email</h1><p>Press the button to confirm this address for your Chessito account.</p><form method="post" action="/confirm-email"><input type="hidden" name="token" value="${esc(token)}"><button type="submit">Confirm email</button></form>`);
const confirmedPage=ok=>ok?shell('Email confirmed',`<h1>Email confirmed</h1><p>You can now reset your password by email if you ever forget it.</p><p class="note"><a href="/">Open Chessito</a></p>`):shell('Link expired',`<h1>This link does not work</h1><p>It may have expired or already been used. Open Settings → Account and request a new confirmation email.</p><p class="note"><a href="/">Open Chessito</a></p>`);
const closedPage=()=>shell('Sign-ups closed',`<h1>Sign-ups are closed</h1><p>Ask the owner if you think you should have access.</p><p class="note"><a href="/login">Back to sign in</a></p>`);
const badInvitePage=()=>shell('Invite',`<h1>This invite does not work</h1><p>It may have been used, revoked or expired. Ask your friend for a new link.</p><p class="note"><a href="/login">Back to sign in</a></p>`);

// ── account API (JSON, signed-in users) ────────────────────────────────────
async function account(req,res,user){
 const url=new URL(req.url,'http://x');const route=url.pathname;const owner=user.role==='owner';
 try{
  if(route==='/account/me'&&req.method==='GET')return send(res,200,{...auth.publicUser(user),signup,origin:originOf(req),email:{configured:!!mail,address:user.email,verified:!!user.email_verified}});
  if(route==='/account/email'&&req.method==='POST'){
   if(!mail)return send(res,400,{error:'Email is not set up on this server.'});
   if(emailByUser.wait(user.id))return send(res,429,{error:'Too many emails. Try again in an hour.'});
   const b=await readJson(req);const r=auth.startEmailChange(db,user,b.email);if(r.error)return send(res,400,{error:r.error});
   emailByUser.fail(user.id);
   try{await sendMail(mail,{to:r.email,...verifyEmail({name:user.display_name,url:`${originOf(req)}/confirm-email?token=${r.token}`})});}catch{return send(res,502,{error:'The email could not be sent. Check the sender settings.'});}
   return send(res,200,{ok:true});
  }
  if(req.method!=='POST'&&!(route==='/account/invites'||route==='/account/members'))return send(res,405,{error:'Method not allowed.'});
  if(route==='/account/password'&&req.method==='POST'){
   if(passwordByUser.wait(user.id))return send(res,429,{error:'Too many attempts. Wait a minute and try again.'});
   const b=await readJson(req);const msg=await auth.changePassword(db,user.id,b.current,b.next,cookieToken(req));
   if(msg){if(msg.includes('current'))passwordByUser.fail(user.id);return send(res,400,{error:msg});}return send(res,200,{ok:true});
  }
  if(route==='/account/signout-all'&&req.method==='POST'){auth.revokeSessions(db,user.id,cookieToken(req));return send(res,200,{ok:true});}
  if(route==='/account/delete'&&req.method==='POST'){
   if(owner)return send(res,400,{error:'The owner account cannot be deleted.'});
   if(passwordByUser.wait(user.id))return send(res,429,{error:'Too many attempts. Wait a minute and try again.'});
   const b=await readJson(req);if(!(await auth.verifyPassword(String(b.password??''),user.password_hash))){passwordByUser.fail(user.id);return send(res,400,{error:'That password is not correct.'});}
   auth.deleteUser(db,user.id);return send(res,200,{ok:true},{'Set-Cookie':sessionCookie('',0)});
  }
  if(route.startsWith('/account/invites')||route.startsWith('/account/members')){
   if(!owner)return send(res,403,{error:'Only the owner can do that.'});
   if(route==='/account/invites'&&req.method==='GET')return send(res,200,{invites:auth.listInvites(db)});
   if(route==='/account/invites'&&req.method==='POST'){
    if(signup!=='invite')return send(res,400,{error:'Sign-ups are closed (CHESSITO_SIGNUP=closed).'});
    const b=await readJson(req);const addr=auth.normalizeEmail(b.email);
    if(addr&&!auth.validEmail(addr))return send(res,400,{error:'Enter a valid email address.'});
    const days=Number(b.days)||7;const inv=auth.createInvite(db,{createdBy:user.id,days,uses:addr?1:Number(b.uses)||1,note:b.note,email:addr});
    const url=`${originOf(req)}/register?invite=${inv.code}`;let emailed=false,emailError='';
    if(addr){if(!mail)emailError='Email is not set up on this server, so share the link yourself.';
     else try{await sendMail(mail,{to:addr,...inviteEmail({inviter:user.display_name,url,days})});emailed=true;}catch{emailError='The email could not be sent, so share the link yourself.';}}
    return send(res,200,{id:inv.id,url,email:addr||null,emailed,emailError});
   }
   if(route==='/account/invites/revoke'&&req.method==='POST'){const b=await readJson(req);return send(res,200,{ok:auth.revokeInvite(db,String(b.id))});}
   if(route==='/account/members'&&req.method==='GET')return send(res,200,{members:auth.listUsers(db)});
   if(route==='/account/members'&&req.method==='POST'){
    const b=await readJson(req);const id=String(b.id||'');
    const ok=b.action==='disable'?auth.setDisabled(db,id,true):b.action==='enable'?auth.setDisabled(db,id,false):b.action==='delete'?auth.deleteUser(db,id):false;
    return send(res,ok?200:400,ok?{ok:true}:{error:'That action is not allowed.'});
   }
  }
  return send(res,404,{error:'Not found.'});
 }catch(e){return send(res,e.message==='bad request'||e.message==='too large'?400:500,{error:e.message==='bad request'||e.message==='too large'?'Invalid request.':'The request could not be completed.'});}
}

async function handle(req,res){
 const nonce=randomBytes(18).toString('base64');const requestId=randomUUID();const started=Date.now();
 const csp=`default-src 'self'; script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
 res.setHeader('Content-Security-Policy',csp);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('X-Request-Id',requestId);
 if(publicOrigin?.startsWith('https:'))res.setHeader('Strict-Transport-Security','max-age=31536000');
 res.on('finish',()=>{if(res.statusCode>=400||req.method!=='GET')console.log(JSON.stringify({requestId,method:req.method,path:(req.url||'/').split('?')[0],status:res.statusCode,ms:Date.now()-started}));});
 if(req.url==='/healthz'){
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let healthy=false;try{healthy=(await fetch(internalOrigin+'/api/health',{signal:AbortSignal.timeout(2000)})).ok;}catch{}
  res.writeHead(healthy?200:503,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end(req.method==='HEAD'?'':healthy?'ok':'unavailable');return;
 }
 if(publicOrigin&&req.headers.host!==new URL(publicOrigin).host){res.writeHead(421);res.end('Use the configured Chessito address.');return;}
 if(['/manifest.webmanifest','/sw.js','/offline.html','/icons/icon-192.png','/icons/icon-512.png','/fonts/plus-jakarta-sans-latin-wght-normal.woff2','/fonts/sora-latin-wght-normal.woff2'].includes(req.url)&&req.method==='GET'){
  try{const bytes=readFileSync(path.join('public',req.url));const type=req.url.endsWith('.png')?'image/png':req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.woff2')?'font/woff2':req.url.endsWith('.webmanifest')?'application/manifest+json':'text/html';res.writeHead(200,{'Content-Type':type,'Cache-Control':req.url==='/sw.js'?'no-store':'public, max-age=3600','Service-Worker-Allowed':'/'});res.end(bytes);}catch{res.writeHead(404);res.end();}return;
 }
 const origin=originOf(req);
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);res.end('Request origin is not allowed.');return;}
 const html={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'};
 const ip=clientIp(req);
 if(req.url==='/login'){
  if(req.method==='GET'){res.writeHead(200,html);res.end(loginPage());return;}
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  let text;try{text=await readText(req,4096);}catch{res.writeHead(413);res.end();return;}
  const f=new URLSearchParams(text);const name=auth.normalizeUsername(f.get('username')||'');
  const wait=Math.max(loginByIp.wait(ip),loginByName.wait('u:'+name));
  if(wait){res.writeHead(429,{...html,'Retry-After':String(wait)});res.end(loginPage(`Too many attempts. Try again in ${wait>60?Math.ceil(wait/60)+' minutes':wait+' seconds'}.`,name));return;}
  const user=await auth.authenticate(db,name,f.get('password')||'');
  if(!user){loginByIp.fail(ip);loginByName.fail('u:'+name);res.writeHead(401,html);res.end(loginPage('Incorrect username or password.',name));return;}
  loginByName.reset('u:'+name);
  const remember=f.get('remember')==='1';
  const token=auth.createSession(db,user.id,req.headers['user-agent'],remember);
  res.writeHead(303,{Location:'/','Cache-Control':'no-store','Set-Cookie':sessionCookie(token,remember?2592000:null)});res.end();return;
 }
 if(req.url?.split('?')[0]==='/register'){
  if(signup==='closed'){res.writeHead(403,html);res.end(closedPage());return;}
  if(req.method==='GET'){const code=new URL(req.url,'http://x').searchParams.get('invite')||'';
   if(!auth.inviteValid(db,code)){res.writeHead(200,html);res.end(badInvitePage());return;}
   res.writeHead(200,html);res.end(registerPage({invite:code,email:auth.inviteEmail(db,code)}));return;}
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  if(registerByIp.wait(ip)){res.writeHead(429,{...html,'Retry-After':'60'});res.end(shell('Slow down',`<h1>Too many attempts</h1><p>Try again in a minute.</p>`));return;}
  let text;try{text=await readText(req,4096);}catch{res.writeHead(413);res.end();return;}
  const f=new URLSearchParams(text);const form={invite:f.get('invite')||'',username:f.get('username')||'',displayName:f.get('displayName')||''};
  if((f.get('password')||'')!==(f.get('confirm')||'')){res.writeHead(400,html);res.end(registerPage({...form,email:auth.inviteEmail(db,form.invite),error:'The two passwords do not match.'}));return;}
  const result=await auth.register(db,{code:form.invite,username:form.username,displayName:form.displayName,password:f.get('password')||''});
  if(result.error){registerByIp.fail(ip);res.writeHead(400,html);res.end(registerPage({...form,email:auth.inviteEmail(db,form.invite),error:result.error}));return;}
  const token=auth.createSession(db,result.user.id,req.headers['user-agent']);
  res.writeHead(303,{Location:'/','Cache-Control':'no-store','Set-Cookie':sessionCookie(token,2592000)});res.end();return;
 }
 if(req.url?.split('?')[0]==='/forgot'){
  if(req.method==='GET'){res.writeHead(200,html);res.end(forgotPage());return;}
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  let text;try{text=await readText(req,4096);}catch{res.writeHead(413);res.end();return;}
  // The answer is the same whether or not the account exists, and sending never delays it.
  const limited=forgotByIp.wait(ip)>0;forgotByIp.fail(ip);
  if(mail&&!limited){const u=auth.userByLogin(db,new URLSearchParams(text).get('identifier')||'');
   if(u&&!forgotByUser.wait(u.id)){forgotByUser.fail(u.id);const token=auth.startReset(db,u);const m=resetEmail({name:u.display_name,url:`${origin}/reset?token=${token}`});void sendMail(mail,{to:u.email,...m}).catch(()=>console.error('A password reset email could not be sent.'));}}
  res.writeHead(200,html);res.end(forgotSentPage());return;
 }
 if(req.url?.split('?')[0]==='/reset'){
  if(req.method==='GET'){const token=new URL(req.url,'http://x').searchParams.get('token')||'';res.writeHead(200,html);res.end(auth.peekToken(db,token,'reset')?resetPage(token):resetBadPage());return;}
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  if(resetByIp.wait(ip)){res.writeHead(429,{...html,'Retry-After':'60'});res.end(shell('Slow down',`<h1>Too many attempts</h1><p>Try again in a minute.</p>`));return;}
  let text;try{text=await readText(req,4096);}catch{res.writeHead(413);res.end();return;}
  const f=new URLSearchParams(text);const t=f.get('token')||'';
  if((f.get('password')||'')!==(f.get('confirm')||'')){res.writeHead(400,html);res.end(resetPage(t,'The two passwords do not match.'));return;}
  const r=await auth.completeReset(db,t,f.get('password')||'');
  if(r.error){const live=!!auth.peekToken(db,t,'reset');if(!live)resetByIp.fail(ip);res.writeHead(400,html);res.end(live?resetPage(t,r.error):resetBadPage());return;}
  res.writeHead(200,html);res.end(loginPage('',r.user.username,'Password updated. Sign in with your new password.'));return;
 }
 if(req.url?.split('?')[0]==='/confirm-email'){
  if(req.method==='GET'){res.writeHead(200,html);res.end(confirmPage(new URL(req.url,'http://x').searchParams.get('token')||''));return;}
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  let text;try{text=await readText(req,4096);}catch{res.writeHead(413);res.end();return;}
  const ok=!!auth.confirmEmail(db,new URLSearchParams(text).get('token')||'');res.writeHead(ok?200:400,html);res.end(confirmedPage(ok));return;
 }
 const user=await currentUser(req);
 if(!user){if(req.url?.startsWith('/api/')||req.url?.startsWith('/account/')){res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Please sign in again.'}));}else{res.writeHead(303,{Location:'/login','Cache-Control':'no-store'});res.end();}return;}
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!req.headers.authorization&&!req.headers.origin){res.writeHead(403);res.end('An Origin header is required.');return;}
 if(req.url==='/logout'&&req.method==='POST'){auth.revokeSession(db,cookieToken(req));res.writeHead(303,{Location:'/login','Cache-Control':'no-store','Set-Cookie':sessionCookie('',0)});res.end();return;}
 if(req.url?.startsWith('/account/')){await account(req,res,user);return;}
 if(req.method==='POST'&&['/api/coach','/api/engines/move'].includes(req.url)){
  const key=user.id+':'+req.url;let counter=usage.get(key);if(!counter||Date.now()-counter.time>60000){counter={time:Date.now(),count:0};usage.set(key,counter);}if(++counter.count>(req.url==='/api/coach'?12:60)){res.writeHead(429,{'Content-Type':'application/json','Retry-After':'60'});res.end(JSON.stringify({error:'Too many coaching or engine requests. Try again in a minute.'}));return;}
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
 for(const name of Object.keys(headers))if(name.startsWith('oai-')||name.startsWith('x-forwarded-')||['forwarded','authorization','connection','host','transfer-encoding','content-length','accept-encoding','cf-connecting-ip'].includes(name))delete headers[name];
 headers['oai-authenticated-user-id']=user.id;
 headers['oai-authenticated-user-email']=`${user.username}@chessito.local`;
 headers['oai-authenticated-user-full-name']=encodeURIComponent(user.display_name);
 headers['oai-authenticated-user-full-name-encoding']='percent-encoded-utf-8';
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
server.listen(listenPort,process.env.CHESSITO_BIND_IP||'0.0.0.0',()=>console.log(`Chessito production server ready on port ${listenPort}. Sign in with the owner account; invite friends from Settings. Email: ${mail?'on (Resend)':'off (set RESEND_API_KEY and CHESSITO_EMAIL_FROM to turn on)'}.`));
function stop(){if(stopping)return;stopping=true;server.close();worker.kill('SIGTERM');setTimeout(()=>{try{db.close();}catch{}process.exit(0);},3000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
