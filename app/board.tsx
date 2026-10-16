'use client';
import { useState } from 'react';
import { Chess, type Square, type Move } from 'chess.js';
import Piece from './piece';
import { classes, type Cls } from '../lib/review';

export type Arrow = { from: string; to: string; color?: string };
type Props = {
 fen: string;
 flipped: boolean;
 selected: Square | null;
 legal: Move[];
 lastMove?: { from: string; to: string } | null;
 canDrag: (from: Square) => boolean;
 onSquare: (s: Square) => void;
 onDrop: (from: Square, to: Square) => void;
 onDragStart: (s: Square) => void;
 arrows?: Arrow[];
 badge?: { square: string; cls: Cls } | null;
 highlights?: string[];
};
const names: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const GREEN = '#15781b', RED = '#c33';

function center(s: string, flipped: boolean) {
 const f = s.charCodeAt(0) - 97, r = Number(s[1]) - 1;
 return { x: (flipped ? 7 - f : f) + .5, y: (flipped ? r : 7 - r) + .5 };
}

// Chess.com-style board: right-click highlights a square, right-drag draws an arrow,
// any left click clears them. Engine arrows (best move) come in through `arrows`.
export default function Board({ fen, flipped, selected, legal, lastMove, canDrag, onSquare, onDrop, onDragStart, arrows = [], badge, highlights = [] }: Props) {
 const board = new Chess(fen);
 const [marks, setMarks] = useState<string[]>([]);
 const [drawn, setDrawn] = useState<Arrow[]>([]);
 const [rightFrom, setRightFrom] = useState<Square | null>(null);
 const squares = Array.from({ length: 64 }, (_, i) => `${'abcdefgh'[flipped ? 7 - i % 8 : i % 8]}${flipped ? Math.floor(i / 8) + 1 : 8 - Math.floor(i / 8)}` as Square);
 const toggle = <T,>(list: T[], same: (x: T) => boolean, add: T) => list.some(same) ? list.filter(x => !same(x)) : [...list, add];
 function release(s: Square) {
  if (!rightFrom) return;
  if (rightFrom === s) setMarks(m => toggle(m, x => x === s, s));
  else setDrawn(d => toggle(d, a => a.from === rightFrom && a.to === s, { from: rightFrom, to: s }));
  setRightFrom(null);
 }
 const all: Arrow[] = [...arrows, ...drawn];
 return <div className="chessboard" aria-label="Chess board" onContextMenu={e => e.preventDefault()}>
  {squares.map((s, i) => {
   const p = board.get(s);
   const dark = (s.charCodeAt(0) + Number(s[1])) % 2 === 0;
   const target = legal.some(m => m.to === s);
   const check = p?.type === 'k' && p.color === board.turn() && board.isCheck();
   return <button key={s}
    className={`square ${dark ? 'dark' : 'light'} ${selected === s ? 'selected' : ''} ${lastMove && (lastMove.from === s || lastMove.to === s) ? 'last' : ''} ${check ? 'in-check' : ''} ${marks.includes(s) || highlights.includes(s) ? 'marked' : ''}`}
    aria-label={`${s}${p ? ` ${p.color === 'w' ? 'white' : 'black'} ${names[p.type]}` : ''}`}
    onMouseDown={e => { if (e.button === 2) setRightFrom(s); }}
    onMouseUp={e => { if (e.button === 2) release(s); }}
    onClick={() => { setMarks([]); setDrawn([]); onSquare(s); }}
    onDragOver={e => e.preventDefault()}
    onDrop={e => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain') as Square; if (from) onDrop(from, s); }}>
    {i % 8 === 0 && <span className="rank">{s[1]}</span>}
    {i >= 56 && <span className="file">{s[0]}</span>}
    {p && <span draggable={canDrag(s)} onDragStart={e => { e.dataTransfer.setData('text/plain', s); onDragStart(s); }}><Piece type={p.type} color={p.color} /></span>}
    {target && <span className={p ? 'legal capture' : 'legal'} />}
    {badge?.square === s && <span className="cls-badge" style={{ background: classes[badge.cls].color }} aria-label={classes[badge.cls].label}>{classes[badge.cls].symbol}</span>}
   </button>;
  })}
  <svg className="board-arrows" viewBox="0 0 8 8" aria-hidden="true">
   <defs>{[GREEN, RED, '#4b8bf5'].map(c => <marker key={c} id={`ah${c.slice(1)}`} markerWidth="4" markerHeight="4" refX="2.6" refY="2" orient="auto"><path d="M0 0L4 2L0 4z" fill={c} /></marker>)}</defs>
   {all.map((a, i) => {
    const f = center(a.from, flipped), t = center(a.to, flipped), c = a.color || GREEN;
    const len = Math.hypot(t.x - f.x, t.y - f.y) || 1, shorten = .28;
    const ex = t.x - (t.x - f.x) / len * shorten, ey = t.y - (t.y - f.y) / len * shorten;
    return <line key={`${a.from}${a.to}${i}`} x1={f.x} y1={f.y} x2={ex} y2={ey} stroke={c} strokeWidth=".16" strokeLinecap="round" opacity=".8" markerEnd={`url(#ah${c.slice(1)})`} />;
   })}
  </svg>
 </div>;
}

// Pieces a player has captured, plus their material lead, for the player bars.
export function Captured({ pieces, victim, lead }: { pieces: string[]; victim: 'w' | 'b'; lead: number }) {
 return <span className="captured" aria-label={`Captured ${pieces.length} pieces`}>
  {pieces.map((t, i) => <span key={i} className={`cap ${t}`}><Piece type={t} color={victim} /></span>)}
  {lead > 0 && <span className="lead">+{lead}</span>}
 </span>;
}
