import {Chess} from 'chess.js';
import {getDb} from '../../../db';
import {games} from '../../../db/schema';
import {identity,json,failure,body} from '../../../lib/server';
export async function POST(req:Request){try{
 const user=await identity(req),input=await body(req);if(!Array.isArray(input.games)||input.games.length<1||input.games.length>25)return json({error:'Send 1–25 games per batch.'},400);
 const rows=[];for(const item of input.games){if(typeof item.pgn!=='string'||item.pgn.length>500000)return json({error:'Invalid PGN size.'},400);const chess=new Chess();try{chess.loadPgn(item.pgn);}catch{return json({error:'Invalid PGN.'},400);}if(!chess.history().length||chess.history().length>2000)return json({error:'Each game must have 1–2,000 plies.'},400);
  const pgn=chess.pgn(),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pgn));const id='pgn-'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');const h=chess.getHeaders(),now=new Date().toISOString();const data={id,pgn,title:`${h.White||'White'} vs. ${h.Black||'Black'}`.slice(0,160),players:{white:h.White||'White',black:h.Black||'Black'},createdAt:now,updatedAt:now,result:h.Result||'*',source:'imported',color:'w',bot:0,engine:'stockfish',review:[],revision:1};rows.push({userId:user,id,data:JSON.stringify(data),updatedAt:now});
 }
 // A single SQLite INSERT is atomic; retrying the batch preserves prior reviews.
 const result=await getDb().insert(games).values(rows).onConflictDoNothing();return json({added:result.meta.changes,duplicates:rows.length-result.meta.changes});
}catch(e){return failure(e);}}
