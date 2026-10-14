import {eq,asc} from 'drizzle-orm';
import {getDb} from '../../../db';
import {games} from '../../../db/schema';
import {identity,failure} from '../../../lib/server';
export async function GET(req:Request){try{const user=await identity(req);let offset=0;const encoder=new TextEncoder();const stream=new ReadableStream({async pull(controller){try{const rows=await getDb().select({data:games.data}).from(games).where(eq(games.userId,user)).orderBy(asc(games.id)).limit(25).offset(offset);for(const row of rows)controller.enqueue(encoder.encode(JSON.parse(row.data).pgn+'\n\n'));offset+=rows.length;if(rows.length<25)controller.close();}catch(e){controller.error(e);}}});return new Response(stream,{headers:{'Content-Type':'application/x-chess-pgn','Content-Disposition':'attachment; filename="chessito-library.pgn"','Cache-Control':'no-store'}});}catch(e){return failure(e);}}
