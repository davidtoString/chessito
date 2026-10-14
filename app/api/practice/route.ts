import {eq,desc} from 'drizzle-orm';
import {getDb} from '../../../db';
import {practiceAttempts} from '../../../db/schema';
import {identity,json,failure,body} from '../../../lib/server';
import {puzzles,validateCompletion,type PracticeProgress,type PracticeResult} from '../../../lib/practice';

export async function GET(req:Request){try{
 const user=await identity(req);const rows=await getDb().select().from(practiceAttempts).where(eq(practiceAttempts.userId,user)).orderBy(desc(practiceAttempts.completedAt));
 const progress:PracticeProgress={};for(const row of rows){const result:PracticeResult=JSON.parse(row.data);const previous=progress[row.puzzleId]||{completions:0,clean:0,lastCompleted:row.completedAt};previous.completions++;if(!result.mistakes&&!result.hints&&!result.revealed)previous.clean++;progress[row.puzzleId]=previous;}
 return json({progress});
}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const user=await identity(req),result=await body(req);const puzzle=puzzles.find(p=>p.id===result.puzzleId);
 if(!puzzle||typeof result.id!=='string'||!/^[-\w]{1,80}$/.test(result.id)||!Array.isArray(result.moves)||result.moves.length>10||!result.moves.every((m:unknown)=>typeof m==='string'&&/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))||!Number.isInteger(result.mistakes)||result.mistakes<0||result.mistakes>1000||!Number.isInteger(result.hints)||result.hints<0||result.hints>3||typeof result.revealed!=='boolean')return json({error:'Invalid practice result.'},400);
 if(!validateCompletion(puzzle,result.moves))return json({error:'The drill solution is incomplete or invalid.'},400);
 const completedAt=new Date().toISOString();const data={...result,completedAt};await getDb().insert(practiceAttempts).values({userId:user,id:result.id,puzzleId:puzzle.id,data:JSON.stringify(data),completedAt}).onConflictDoNothing();
 return json({ok:true});
}catch(e){return failure(e);}}
