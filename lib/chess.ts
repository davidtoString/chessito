import { Chess, type Move } from 'chess.js';
export type Evaluation = { cp: number; mate?: number; best: string; depth: number };
export type ReviewMove = { ply: number; san: string; color: string; before: Evaluation; after: Evaluation; loss: number; label: string; advice: string; bestSan: string };
export type GameRecord = { id: string; pgn: string; title: string; createdAt: string; updatedAt: string; result: string; source: 'played'|'imported'; color: 'w'|'b'; bot: number; engine: string; review: ReviewMove[]; summary?: string; revision?:number; timeControl?:{base:number;inc:number}; clock?:{w:number;b:number}; reviewCount?:number; players?:{white:string;black:string}; outcome?:'won'|'lost'|'drawn'|'unfinished'|'other'; gameDate?:string };
export { bots } from './bots.ts';
import { bots as botList } from './bots.ts';
export function gameResult(c: Chess): string {
 if(c.isCheckmate()) return c.turn()==='w'?'0-1':'1-0';
 if(c.isDraw()) return '1/2-1/2';
 return '*';
}
export function terminalEval(c: Chess): Evaluation | null {
 if(c.isCheckmate()) return {cp:c.turn()==='w'?-10000:10000,mate:0,best:'',depth:0};
 if(c.isDraw()) return {cp:0,best:'',depth:0};
 return null;
}
export function toSan(fen: string, uci: string) {
 try { return new Chess(fen).move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'}).san; } catch { return '—'; }
}
export function reviewMove(move: Move, before: Evaluation, after: Evaluation, ply: number): ReviewMove {
 const loss=Math.max(0,(before.cp-after.cp)*(move.color==='w'?1:-1));
 const bestSan=toSan(move.before,before.best);
 const best=move.san===bestSan;
 const label=best?'Best move':loss<35?'Good move':loss<100?'Inaccuracy':loss<250?'Mistake':'Blunder';
 let advice=best?'You found the engine’s preferred move. Keep checking your opponent’s threats.':loss<35?'A sound move. Before the next one, scan for checks, captures, and threats.':`The evaluation fell by about ${(loss/100).toFixed(1)} pawns. Compare your move with ${bestSan} and check what your opponent can capture or threaten.`;
 if(loss>=35&&after.mate!==undefined&&after.cp*(move.color==='w'?1:-1)<0) advice=`This move allows a forced checkmate${after.mate?` in ${Math.abs(after.mate)} move${Math.abs(after.mate)===1?'':'s'}`:''}. Compare with ${bestSan} and look for a way to protect your king.`;
 if(move.san.includes('#')) advice='Checkmate! The opposing king has no legal escape.';
 else if(best && move.flags.includes('k')) advice='Castling brings your king to safety and connects your rook to the game.';
 else if(best && ['n','b'].includes(move.piece) && ply<16) advice='Good development. Bringing a minor piece into play helps you fight for the center.';
 return {ply,san:move.san,color:move.color,before,after,loss,label,advice,bestSan};
}
export function parsePgnCollection(text: string): Chess[] {
 if(!text.trim()) throw new Error('Paste a PGN or choose a .pgn file first.');
 if(text.length>500000) throw new Error('Please import a PGN file smaller than 500 KB.');
 const chunks=text.trim().split(/\r?\n\s*\r?\n(?=\s*\[(?:Event|Site|White)\s)/);
 if(chunks.length>50) throw new Error('Import up to 50 games at a time.');
 return chunks.map((pgn,i)=>{ const c=new Chess(); try{c.loadPgn(pgn);}catch{throw new Error(`Game ${i+1} contains invalid PGN. Check its moves and headers.`);} if(!c.history().length)throw new Error(`Game ${i+1} has no moves to analyze.`);return c; });
}
const values: Record<string,number>={p:100,n:320,b:330,r:500,q:900,k:0};
function material(c: Chess) { return c.board().flat().reduce((s,p)=>s+(p?(p.color==='w'?1:-1)*(values[p.type]+(p.type==='p'? (p.color==='w'?Number(p.square[1])-2:7-Number(p.square[1]))*5:0)):0),0); }
export function practiceMove(c: Chess, level: number): string {
 function search(g:Chess, depth:number, alpha:number, beta:number):number {
  const end=terminalEval(g); if(end)return end.cp;
  if(!depth)return material(g);
  const white=g.turn()==='w'; let value=white?-Infinity:Infinity;
  for(const m of g.moves({verbose:true}).sort((a,b)=>Number(!!b.captured)-Number(!!a.captured))){g.move(m);const v=search(g,depth-1,alpha,beta);g.undo();value=white?Math.max(value,v):Math.min(value,v);if(white)alpha=Math.max(alpha,value);else beta=Math.min(beta,value);if(beta<=alpha)break;}
  return value;
 }
 const moves=c.moves({verbose:true});
 if(!moves.length)return '';
 if(Math.random()<botList[level].chance) {const m=moves[Math.floor(Math.random()*moves.length)];return m.from+m.to+(m.promotion||'');}
 const color=c.turn()==='w'?1:-1;let best=moves[0],value=-Infinity;
 for(const m of moves){c.move(m);const v=search(c,level>1?2:1,-Infinity,Infinity)*color+Math.random()*8;c.undo();if(v>value){value=v;best=m;}}
 return best.from+best.to+(best.promotion||'');
}
