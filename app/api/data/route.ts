import { and, eq, desc, like, sql } from 'drizzle-orm';
import { Chess } from 'chess.js';
import { getDb } from '../../../db';
import { games,preferences } from '../../../db/schema';
import { identity,json,failure,body,encrypt } from '../../../lib/server';
export async function GET(req:Request){try{const user=await identity(req);const db=getDb();const url=new URL(req.url);const id=url.searchParams.get('id');
 if(id){const [row]=await db.select().from(games).where(and(eq(games.userId,user),eq(games.id,id)));return row?json({game:JSON.parse(row.data)}):json({error:'Game not found.'},404);}
 const cursor=Math.max(0,Math.min(1000000,Number(url.searchParams.get('cursor'))||0)),limit=50;const search=(url.searchParams.get('search')||'').slice(0,120);const where=and(eq(games.userId,user),search?like(games.data,'%'+search+'%'):undefined);
 const projection=url.searchParams.get('view')==='library'?sql<string>`json_object('id',${games.id},'title',json_extract(${games.data},'$.title'),'createdAt',json_extract(${games.data},'$.createdAt'),'updatedAt',${games.updatedAt},'result',json_extract(${games.data},'$.result'),'source',json_extract(${games.data},'$.source'),'color',json_extract(${games.data},'$.color'),'bot',json_extract(${games.data},'$.bot'),'engine',json_extract(${games.data},'$.engine'),'revision',coalesce(json_extract(${games.data},'$.revision'),0),'players',json_extract(${games.data},'$.players'),'reviewCount',json_array_length(json_extract(${games.data},'$.review')),'review',json('[]'),'pgn','')`:games.data;
 const rows=await db.select({data:projection}).from(games).where(where).orderBy(desc(games.updatedAt),desc(games.id)).limit(limit).offset(cursor);
 const [totals]=await db.select({count:sql<number>`count(*)`}).from(games).where(where);const [p]=await db.select().from(preferences).where(eq(preferences.userId,user));
 return json({games:rows.map(r=>JSON.parse(r.data)),nextCursor:cursor+rows.length<totals.count?cursor+rows.length:null,total:totals.count,settings:p?{...JSON.parse(p.data),hasKey:!!p.encryptedKey}:{provider:'none',model:'',hasKey:false,autoCoach:false}});
}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity(req);const b=await body(req);const db=getDb();if(b.type==='game'){
 const g=b.game;if(!g||typeof g.id!=='string'||g.id.length>80||typeof g.pgn!=='string'||g.pgn.length>500000||!['played','imported'].includes(g.source)||!['w','b'].includes(g.color)||!['*','1-0','0-1','1/2-1/2'].includes(g.result)||!Array.isArray(g.review))return json({error:'Invalid game.'},400);
 try{new Chess().loadPgn(g.pgn);}catch{return json({error:'Invalid PGN.'},400);}
 if(!Number.isInteger(g.bot)||g.bot<0||g.bot>3||!['stockfish','practice','maia','lc0','arasan','fairy'].includes(g.engine)||g.review.length>2000||typeof g.createdAt!=='string'||typeof g.title!=='string')return json({error:'Invalid game metadata.'},400);
 const [previous]=await db.select().from(games).where(and(eq(games.userId,user),eq(games.id,g.id)));const old=previous?JSON.parse(previous.data):null;
 const revision=old?.revision||0;if((g.revision||0)!==revision)return json({error:'This game changed on another device. Reload your library before continuing; your pending draft is kept on this device.',conflict:true},409);
 const data={...g,revision:revision+1,title:g.title.slice(0,160),updatedAt:new Date().toISOString()};
 const result=previous?await db.update(games).set({data:JSON.stringify(data),updatedAt:data.updatedAt}).where(and(eq(games.userId,user),eq(games.id,g.id),eq(games.data,previous.data))):await db.insert(games).values({userId:user,id:g.id,data:JSON.stringify(data),updatedAt:data.updatedAt}).onConflictDoNothing();
 if(result.meta.changes!==1)return json({error:'This game changed on another device. Reload your library before continuing.',conflict:true},409);
 return json({ok:true,revision:data.revision});
 }if(b.type==='settings'){
 const s=b.settings;if(!s||!['none','gemini','claude','openai'].includes(s.provider)||typeof s.model!=='string'||s.model.length>120||!/^[-\w./]*$/.test(s.model))return json({error:'Invalid provider or model ID.'},400);
 const [old]=await db.select().from(preferences).where(eq(preferences.userId,user));const prior=old?JSON.parse(old.data):{};let encryptedKey=prior.provider===s.provider?old?.encryptedKey||null:null;
 if(s.clearKey||s.provider==='none')encryptedKey=null;
 if(typeof s.apiKey==='string'&&s.apiKey.trim()){if(s.apiKey.length>1000)return json({error:'API key is too long.'},400);encryptedKey=await encrypt(s.apiKey.trim(),user+':'+s.provider);}
 const data=JSON.stringify({...prior,provider:s.provider,model:s.model,autoCoach:!!s.autoCoach});await db.insert(preferences).values({userId:user,data,encryptedKey}).onConflictDoUpdate({target:preferences.userId,set:{data,encryptedKey}});return json({ok:true,hasKey:!!encryptedKey});
 }if(b.type==='profile'){
 if(!Array.isArray(b.usernames)||b.usernames.length>20||!b.usernames.every((n:unknown)=>typeof n==='string'&&n.trim().length>0&&n.length<=80))return json({error:'Enter up to 20 usernames, each at most 80 characters.'},400);
 const [prior]=await db.select().from(preferences).where(eq(preferences.userId,user));const data=JSON.stringify({...prior?JSON.parse(prior.data):{provider:'none',model:'',autoCoach:false},usernames:[...new Set(b.usernames.map((n:string)=>n.trim().normalize('NFC')))]});await db.insert(preferences).values({userId:user,data,encryptedKey:null}).onConflictDoUpdate({target:preferences.userId,set:{data}});return json({ok:true});
 }return json({error:'Unknown operation.'},400);}catch(e){return failure(e);}}
export async function DELETE(req:Request){try{const user=await identity(req);const {id}=await body(req);if(typeof id!=='string')return json({error:'Missing game ID.'},400);await getDb().delete(games).where(and(eq(games.userId,user),eq(games.id,id)));return json({ok:true});}catch(e){return failure(e);}}
