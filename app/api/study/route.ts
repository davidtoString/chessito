import {and,eq,sql,inArray,asc} from 'drizzle-orm';
import {getDb} from '../../../db';
import {games,preferences} from '../../../db/schema';
import {identity,json,failure} from '../../../lib/server';
export async function GET(req:Request){try{const user=await identity(req),db=getDb();const [prefs]=await db.select().from(preferences).where(eq(preferences.userId,user));const names:string[]=(prefs?JSON.parse(prefs.data).usernames||[]:[]).map((n:string)=>n.trim().toLowerCase());if(!names.length)return json({error:'Save your chess usernames first so the coach can identify your moves.'},400);
 const rows=await db.select({id:games.id}).from(games).where(and(eq(games.userId,user),sql`json_extract(${games.data},'$.source')='imported'`,sql`(${inArray(sql`lower(trim(coalesce(json_extract(${games.data},'$.players.white'),'')))`,names)} OR ${inArray(sql`lower(trim(coalesce(json_extract(${games.data},'$.players.black'),'')))`,names)})`)).orderBy(asc(games.id));return json({ids:rows.map(r=>r.id)});
}catch(e){return failure(e);}}
