'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Copy, Power, Trash2 } from 'lucide-react';
import Board, { type Arrow } from './board';
import { Engine, type EngineLine } from '../lib/engine';
import { openingFor, type Openings } from '../lib/openings';
import { play, soundFor } from '../lib/sound';
import { compareMoves, moveFacts, whyGood, walkPv, lineText, scan as scanPosition } from '../lib/explain';
import { ExplanationView, AiExplain, resultContext, type Ask, type Result } from './why-panel';

const START = new Chess().fen();
type Props = { engine: Engine | null; ready: boolean; openings: Openings | null; ask?: Ask };

function scoreText(l: { cp: number; mate?: number }) {
 if (l.mate !== undefined) return l.mate === 0 ? '#' : `M${Math.abs(l.mate)}`;
 return `${l.cp >= 0 ? '+' : ''}${(l.cp / 100).toFixed(1)}`;
}

// Turns a UCI principal variation into numbered SAN text, stopping at the first illegal move.
function pvText(fen: string, pv: string[], max = 8) {
 const g = new Chess(fen); const out: string[] = [];
 for (const u of pv.slice(0, max)) {
  const num = g.moveNumber(), white = g.turn() === 'w';
  try { const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); out.push(white ? `${num}. ${m.san}` : (out.length ? m.san : `${num}… ${m.san}`)); } catch { break; }
 }
 return out.join(' ');
}

export default function AnalysisBoard({ engine, ready, openings, ask = null }: Props) {
 const [explained, setExplained] = useState<Result | null>(null);
 const [startFen, setStartFen] = useState(START);
 const [moves, setMoves] = useState<string[]>([]);
 const [idx, setIdx] = useState(0);
 const [selected, setSelected] = useState<Square | null>(null);
 const [flipped, setFlipped] = useState(false);
 const [on, setOn] = useState(true);
 const [lines, setLines] = useState<EngineLine[]>([]);
 const [text, setText] = useState('');
 const [error, setError] = useState('');
 const [copied, setCopied] = useState('');

 const { fen, fens, last, turn, over } = useMemo(() => {
  const g = new Chess(startFen); const fens = [startFen]; let lastMove: { from: string; to: string } | null = null; let shown = startFen;
  moves.forEach((san, i) => { const m = g.move(san); fens.push(g.fen()); if (i < idx) { lastMove = { from: m.from, to: m.to }; shown = g.fen(); } });
  const cur = new Chess(shown);
  return { fen: shown, fens, last: lastMove as { from: string; to: string } | null, turn: cur.turn(), over: cur.isGameOver() };
 }, [startFen, moves, idx]);

 const board = useMemo(() => new Chess(fen), [fen]);
 const legal = selected ? board.moves({ square: selected, verbose: true }) : [];
 const running = useRef<{ stop: () => void } | null>(null);

 useEffect(() => {
  running.current?.stop(); setLines([]);
  if (!on || !ready || !engine || over) return;
  const t = setTimeout(() => { running.current = engine.analyzeLines(fen, 3, 22, setLines); }, 150);
  return () => { clearTimeout(t); running.current?.stop(); running.current = null; };
 }, [fen, on, ready, engine, over]);

 function go(n: number) { setIdx(Math.max(0, Math.min(moves.length, n))); setSelected(null); }
 useEffect(() => {
  const key = (e: KeyboardEvent) => {
   if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
   if (e.key === 'ArrowLeft') go(idx - 1); else if (e.key === 'ArrowRight') go(idx + 1); else if (e.key === 'Home') go(0); else if (e.key === 'End') go(moves.length); else return;
   e.preventDefault();
  };
  window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
 });

 function tryMove(from: string, to: string) {
  const g = new Chess(fen);
  try {
   const m = g.move({ from, to, promotion: 'q' });
   play(soundFor(m, g.isGameOver()));
   setMoves(old => old[idx] === m.san ? old : [...old.slice(0, idx), m.san]);
   setIdx(idx + 1); setSelected(null);
  } catch { setSelected(null); }
 }
 function clickSquare(s: Square) {
  if (selected && legal.some(m => m.to === s)) { tryMove(selected, s); return; }
  setSelected(board.get(s)?.color === turn ? s : null);
 }
 function load() {
  const raw = text.trim(); if (!raw) return;
  try {
   let c: Chess;
   try { c = new Chess(raw); setStartFen(c.fen()); setMoves([]); setIdx(0); setError(''); return; } catch { c = new Chess(); }
   c.loadPgn(raw);
   const header = c.getHeaders().FEN; const hist = c.history();
   setStartFen(header || START); setMoves(hist); setIdx(hist.length); setError(''); setText('');
  } catch { setError('That is not a valid FEN or PGN.'); }
 }
 function copy(what: 'fen' | 'pgn') {
  let value = fen;
  if (what === 'pgn') { const g = new Chess(startFen); moves.forEach(m => g.move(m)); value = g.pgn(); }
  void navigator.clipboard?.writeText(value).then(() => { setCopied(what); setTimeout(() => setCopied(''), 1500); }).catch(() => {});
 }

 const top = lines[0];
 const arrows: Arrow[] = top ? [{ from: top.pv[0].slice(0, 2), to: top.pv[0].slice(2, 4) }] : [];
 const opening = openingFor(openings, fens, idx);
 const rows = Math.ceil(moves.length / 2);
 const firstMoveNumber = Number(startFen.split(' ')[5]) || 1;
 const blackFirst = startFen.split(' ')[1] === 'b';

 return <div className="training-layout analysis-layout">
  <section className="board-column">
   <div className="board-wrap">
    <div className="eval-bar" aria-label={`Evaluation ${top ? scoreText(top) : 'not available'}`}>
     <div style={{ height: `${top ? (top.mate !== undefined ? (top.mate > 0 ? 100 : 0) : Math.max(3, Math.min(97, 50 + top.cp / 18))) : 50}%` }} />
     <span>{top ? scoreText(top) : '—'}</span>
    </div>
    <Board fen={fen} flipped={flipped} selected={selected} legal={legal} lastMove={last} arrows={arrows}
     canDrag={sq => board.get(sq)?.color === turn}
     onSquare={clickSquare} onDragStart={sq => setSelected(sq)} onDrop={(from, to) => tryMove(from, to)} />
   </div>
   <div className="board-toolbar">
    <div className="replay">
     <button aria-label="First position" onClick={() => go(0)}><ChevronsLeft size={18} /></button>
     <button aria-label="Previous move" onClick={() => go(idx - 1)}><ChevronLeft size={18} /></button>
     <span>{idx} / {moves.length}</span>
     <button aria-label="Next move" onClick={() => go(idx + 1)}><ChevronRight size={18} /></button>
     <button aria-label="Last position" onClick={() => go(moves.length)}><ChevronsRight size={18} /></button>
    </div>
    <div className="toolbar-end">
     <button title="Flip board" aria-label="Flip board" onClick={() => setFlipped(!flipped)}><RefreshCw size={17} /><span>Flip</span></button>
     <button title="Reset board" aria-label="Reset board" onClick={() => { setStartFen(START); setMoves([]); setIdx(0); setSelected(null); }}><Trash2 size={17} /><span>Clear</span></button>
    </div>
   </div>
  </section>
  <aside className="coach-column">
   <section className="engine-card">
    <div className="section-top"><h2>Engine</h2>
     <button className={on ? 'secondary' : 'primary'} onClick={() => setOn(!on)} aria-pressed={on}><Power size={15} />{on ? 'On' : 'Off'}</button>
    </div>
    {!ready && <p className="muted">Loading Stockfish…</p>}
    {ready && on && over && <p className="muted">The game is over in this position.</p>}
    {ready && on && !over && !lines.length && <p className="muted">Thinking…</p>}
    {on && lines.map((l, n) => <div key={l.multipv} className="engine-line-wrap"><button className="engine-line-row" onClick={() => tryMove(l.pv[0].slice(0, 2), l.pv[0].slice(2, 4))} title="Play this line's first move">
     <b className={l.cp >= 0 ? 'plus' : 'minus'}>{scoreText(l)}</b><span>{pvText(fen, l.pv)}</span><small>d{l.depth}</small></button>
     <button className="why-mini" title={n === 0 ? 'Why is this the best move?' : 'Why is the top move better than this one?'} onClick={() => {
      if (n === 0) { const f = moveFacts(fen, l.pv[0]); if (f) setExplained({ good: { san: f.san, reasons: whyGood(f), line: lineText(fen, walkPv(fen, l.pv).sans.slice(0, 6)) } }); }
      else setExplained({ cmp: compareMoves(fen, { pv: lines[0].pv, cp: lines[0].cp, mate: lines[0].mate }, { pv: l.pv, cp: l.cp, mate: l.mate }) });
     }}>Why?</button></div>)}
    {on && lines.length > 0 && <button className="text-action" onClick={() => setExplained({ scan: scanPosition(fen) })}>Scan: checks, captures, threats</button>}
    {explained && <><ExplanationView result={explained} /><AiExplain ask={ask} context={resultContext(fen, explained)} kind={explained.scan ? 'scan' : 'why'} /></>}
   </section>
   <section className="moves-card">
    <div className="section-top"><h2>Moves</h2><span>{moves.length ? `${rows} move${rows === 1 ? '' : 's'}` : 'Make a move on the board'}</span></div>
    {opening && <p className="opening-name"><strong>{opening[0]}</strong> {opening[1]}</p>}
    <div className="move-list">
     {Array.from({ length: Math.ceil((moves.length + (blackFirst ? 1 : 0)) / 2) }, (_, r) => {
      const cells = [r * 2 - (blackFirst ? 1 : 0), r * 2 + 1 - (blackFirst ? 1 : 0)];
      return <div className="move-row" key={r}><span>{firstMoveNumber + r}.</span>
       {cells.map(j => <button key={j} disabled={j < 0 || !moves[j]} className={idx === j + 1 ? 'current-move' : ''} onClick={() => go(j + 1)}>{j < 0 ? '…' : moves[j] || '—'}</button>)}</div>;
     })}
    </div>
   </section>
   <section className="load-card">
    <details>
     <summary>Load a position or game</summary>
     <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste a FEN or PGN" aria-label="FEN or PGN" rows={4} />
     {error && <p className="danger small">{error}</p>}
     <div className="actions"><button className="primary" onClick={load}>Load</button>
      <button className="secondary" onClick={() => copy('fen')}><Copy size={14} />{copied === 'fen' ? 'Copied' : 'Copy FEN'}</button>
      <button className="secondary" onClick={() => copy('pgn')}><Copy size={14} />{copied === 'pgn' ? 'Copied' : 'Copy PGN'}</button></div>
    </details>
   </section>
  </aside>
 </div>;
}
