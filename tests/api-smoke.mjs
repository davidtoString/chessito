import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5173';
const anonymous=await fetch(origin+'/api/data');assert.equal(anonymous.status,401);
const signin=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=signin.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');assert.ok(cookie);
const headers={cookie,'Content-Type':'application/json',origin};
const initial=await (await fetch(origin+'/api/data',{headers})).json();
assert.equal(initial.settings.hasKey,false,'Use a fresh test account with no real key.');
async function post(settings){const r=await fetch(origin+'/api/data',{method:'POST',headers,body:JSON.stringify({type:'settings',settings})});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
try{
 const fake='test-key-not-a-real-secret';
 assert.equal((await post({provider:'gemini',model:'test-model',apiKey:fake,autoCoach:false})).hasKey,true);
 const read=await (await fetch(origin+'/api/data',{headers})).text();assert.ok(!read.includes(fake));assert.ok(!read.includes('encryptedKey'));
 assert.equal((await post({provider:'gemini',model:'test-model',apiKey:'',autoCoach:false})).hasKey,true);
 assert.equal((await post({provider:'gemini',model:'test-model',clearKey:true,autoCoach:false})).hasKey,false);
 const cross=await fetch(origin+'/api/data',{method:'POST',headers:{...headers,origin:'https://unrelated.example'},body:'{}'});assert.equal(cross.status,403);
 const noKey=await fetch(origin+'/api/coach',{method:'POST',headers,body:JSON.stringify({test:true})});assert.equal(noKey.status,400);
 console.log('PASS: anonymous rejection, encrypted key save, secret omission, preserve/remove key, cross-origin rejection, missing-key error. No external provider called.');
}finally{await post({...initial.settings,clearKey:true});}
