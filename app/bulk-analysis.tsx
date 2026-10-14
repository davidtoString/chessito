'use client';
import {useEffect,useRef,useState} from 'react';
import {Chess} from 'chess.js';
import {Sparkles,Square} from 'lucide-react';
import {reviewMove,terminalEval,type GameRecord,type ReviewMove} from '../lib/chess';
import {playerSide} from '../lib/pgn-import';
import {Engine} from '../lib/engine';
type Props={engine:Engine|null;ready:boolean;usernames:string[];onSave:(record:GameRecord)=>Promise<unknown>;onOpen:(record:GameRecord)=>void};
export default function BulkAnalysis({engine,ready,usernames,onSave,onOpen}:Props){const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');const [last,setLast]=useState<GameRecord|null>(null);const running=useRef(false),pause=useRef(false);
 useEffect(()=>{const hidden=()=>{if(document.hidden)pause.current=true;};document.addEventListener('visibilitychange',hidden);return()=>{pause.current=true;document.removeEventListener('visibilitychange',hidden);};},[]);
 async function start(){if(running.current||!engine)return;running.current=true;pause.current=false;setBusy(true);let completed=0;
  try{const response=await fetch('/api/study');const queue=await response.json() as {ids:string[];error?:string};if(!response.ok)throw new Error(queue.error);if(!queue.ids.length){setStatus('No imported games match your saved usernames. Check the White / Black headers and your names in Settings.');return;}
   for(let i=0;i<queue.ids.length;i++){if(pause.current)break;const response=await fetch('/api/data?id='+encodeURIComponent(queue.ids[i]));if(!response.ok)throw new Error('Could not load a game. Sign in again or reconnect, then resume.');const {game:record}=await response.json() as {game:GameRecord};const game=new Chess();game.loadPgn(record.pgn);const side=playerSide(game.getHeaders(),usernames);if(!side)continue;const moves=game.history({verbose:true});const targets=moves.filter(m=>side==='both'||m.color===side);const reviews:ReviewMove[]=[...record.review];let changed=0;
    for(const move of targets){if(pause.current)break;const ply=moves.indexOf(move)+1;if(reviews.some(r=>r.ply===ply&&r.san===move.san))continue;setStatus(`Game ${i+1} / ${queue.ids.length}: ${record.title} · your move ${Math.ceil(ply/2)} (${completed} games finished)`);const before=await engine.evaluate(move.before),after=terminalEval(new Chess(move.after))||await engine.evaluate(move.after);reviews.push(reviewMove(move,before,after,ply));changed++;if(changed%10===0){const next={...record,review:reviews.slice().sort((a,b)=>a.ply-b.ply)};await onSave(next);setLast(next);}await new Promise(r=>setTimeout(r,0));}
    if(changed){const next={...record,review:reviews.slice().sort((a,b)=>a.ply-b.ply)};await onSave(next);setLast(next);}if(!pause.current)completed++;
   }
   setStatus(pause.current?'Analysis paused and saved. Resume to skip moves already reviewed.':`Analysis complete: ${completed} matching games processed. Open a review to study mistakes and recommended moves.`);
  }catch(e){setStatus(e instanceof Error?e.message:'Analysis stopped. Saved reviews can be resumed.');}
  finally{setBusy(false);running.current=false;}
 }
 return <section className="panel bulk-analysis"><div><h2>Study your imported games</h2><p>Review moves by {usernames.length?usernames.join(', '):'your usernames'} with Stockfish. Already reviewed moves are skipped. Large collections can take hours; pause whenever you need to.</p><p className="small muted">Keep this tab open and your device awake. Switching away pauses analysis after the current position. Reviews save every 10 of your moves and at each game’s end. No paid AI calls are made by bulk analysis.</p></div><div className="actions"><button className="primary" disabled={busy||!ready||!usernames.length} onClick={()=>void start()}><Sparkles size={16}/>Analyze / resume my games</button>{busy&&<button className="secondary" onClick={()=>{pause.current=true;setStatus('Pausing after this position and saving…');}}><Square size={16}/>Pause</button>}{last&&<button className="secondary" disabled={busy} onClick={()=>onOpen(last)}>Review last analyzed game</button>}</div>{status&&<p className="analysis-status" role="status">{status}</p>}</section>;
}
