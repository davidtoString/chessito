import { and, eq, desc } from 'drizzle-orm';
import { Chess } from 'chess.js';
import { getDb } from '../../../db';
import { games,preferences } from '../../../db/schema';
import { identity,json,failure,body,encrypt } from '../../../lib/server';
export async function GET(req:Request){try{const user=await identity(req);const db=getDb();const rows=await db.select().from(games).where(eq(games.userId,user)).orderBy(desc(games.updatedAt));const [p]=await db.select().from(preferences).where(eq(preferences.userId,user));return json({games:rows.map(r=>JSON.parse(r.data)),settings:p?{...JSON.parse(p.data),hasKey:!!p.encryptedKey}:{provider:'none',model:'',hasKey:false,autoCoach:false}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity(req);const b=await body(req);const db=getDb();if(b.type==='game'){
 const g=b.game;if(!g||typeof g.id!=='string'||g.id.length>80||typeof g.pgn!=='string'||g.pgn.length>500000||!['played','imported'].includes(g.source)||!['w','b'].includes(g.color)||!['*','1-0','0-1','1/2-1/2'].includes(g.result)||!Array.isArray(g.review))return json({error:'Invalid game.'},400);
 try{new Chess().loadPgn(g.pgn);}catch{return json({error:'Invalid PGN.'},400);}
 const data={...g,title:String(g.title).slice(0,160),updatedAt:new Date().toISOString()};await db.insert(games).values({userId:user,id:g.id,data:JSON.stringify(data),updatedAt:data.updatedAt}).onConflictDoUpdate({target:[games.userId,games.id],set:{data:JSON.stringify(data),updatedAt:data.updatedAt}});return json({ok:true});
 }if(b.type==='settings'){
 const s=b.settings;if(!s||!['none','gemini','claude','openai'].includes(s.provider)||typeof s.model!=='string'||s.model.length>120||!/^[-\w./]*$/.test(s.model))return json({error:'Invalid provider or model ID.'},400);
 const [old]=await db.select().from(preferences).where(eq(preferences.userId,user));const prior=old?JSON.parse(old.data):{};let encryptedKey=prior.provider===s.provider?old?.encryptedKey||null:null;
 if(s.clearKey||s.provider==='none')encryptedKey=null;
 if(typeof s.apiKey==='string'&&s.apiKey.trim()){if(s.apiKey.length>1000)return json({error:'API key is too long.'},400);encryptedKey=await encrypt(s.apiKey.trim(),user+':'+s.provider);}
 const data=JSON.stringify({provider:s.provider,model:s.model,autoCoach:!!s.autoCoach});await db.insert(preferences).values({userId:user,data,encryptedKey}).onConflictDoUpdate({target:preferences.userId,set:{data,encryptedKey}});return json({ok:true,hasKey:!!encryptedKey});
 }return json({error:'Unknown operation.'},400);}catch(e){return failure(e);}}
export async function DELETE(req:Request){try{const user=await identity(req);const {id}=await body(req);if(typeof id!=='string')return json({error:'Missing game ID.'},400);await getDb().delete(games).where(and(eq(games.userId,user),eq(games.id,id)));return json({ok:true});}catch(e){return failure(e);}}
