import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:3100';const headers={Origin:origin,'Content-Type':'application/json',Authorization:'Basic '+Buffer.from((process.env.TEST_USERNAME||'test-owner')+':'+(process.env.TEST_PASSWORD||'Chessito-local-test-credential-2026')).toString('base64')};
async function call(path,method='GET',data){const response=await fetch(origin+path,{method,headers,body:data?JSON.stringify(data):undefined});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;}
const tag='bulk-fixture-'+crypto.randomUUID();let ids=[];const initial=await call('/api/data');
try{
 await call('/api/data','POST',{type:'profile',usernames:['100waystoblunder']});
 const collection=Array.from({length:57},(_,i)=>({pgn:`[Event "${tag}-${i}"]\n[White "${i%2?'Other':'100waystoblunder'}"]\n[Black "${i%2?'100waystoblunder':'Other'}"]\n\n1. e4 e5 2. Nf3 Nc6 *`}));
 for(let i=0;i<collection.length;i+=25){const result=await call('/api/import','POST',{games:collection.slice(i,i+25)});assert.equal(result.added,Math.min(25,collection.length-i));}
 const duplicate=await call('/api/import','POST',{games:collection.slice(0,25)});assert.equal(duplicate.added,0);assert.equal(duplicate.duplicates,25);
 const first=await call('/api/data?view=library&search='+tag);assert.equal(first.games.length,50);assert.equal(first.total,57);assert.equal(first.games[0].pgn,'');assert.deepEqual(first.games[0].review,[]);assert.ok(first.games[0].players.white);const second=await call('/api/data?view=library&search='+tag+'&cursor='+first.nextCursor);assert.equal(second.games.length,7);assert.equal(second.nextCursor,null);ids=[...first.games,...second.games].map(g=>g.id);
 const queue=await call('/api/study');for(const id of ids)assert.ok(queue.ids.includes(id));
 const full=(await call('/api/data?id='+ids[0])).game;assert.match(full.pgn,/1\. e4 e5/);assert.equal(full.revision,1);full.review=[];const saved=await call('/api/data','POST',{type:'game',game:full});assert.equal(saved.revision,2);await call('/api/import','POST',{games:[{pgn:full.pgn}]});assert.equal((await call('/api/data?id='+full.id)).game.revision,2);
 const exportResponse=await fetch(origin+'/api/export',{headers});assert.equal(exportResponse.status,200);assert.match(exportResponse.headers.get('content-disposition'),/chessito-library.pgn/);const exported=await exportResponse.text();for(let i=0;i<57;i++)assert.ok(exported.includes(tag+'-'+i));
 const invalid=await fetch(origin+'/api/practice',{method:'POST',headers,body:JSON.stringify({id:crypto.randomUUID(),puzzleId:'mate-back-rank',moves:['a1a2'],mistakes:0,hints:0,revealed:false})});assert.equal(invalid.status,400);
 console.log('PASS atomic bulk import, duplicate preservation, lightweight pagination, username study queue, full-game retrieval, streamed export, and invalid drill rejection.');
}finally{
 if(!ids.length){let cursor=0;for(;;){const page=await call('/api/data?view=library&search='+tag+'&cursor='+cursor);ids.push(...page.games.map(g=>g.id));if(page.nextCursor===null)break;cursor=page.nextCursor;}}
 for(const id of ids)await call('/api/data','DELETE',{id});await call('/api/data','POST',{type:'profile',usernames:initial.settings.usernames||[]});
}
