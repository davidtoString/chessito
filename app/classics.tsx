'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Play, Pause, ArrowLeft, Microscope, Check } from 'lucide-react';
import Board from './board';
import { ClassBadge } from './review-card';
import { reviewMove } from '../lib/chess';
import { classifyGame, winPercent, type Cls } from '../lib/review';
import { classicTexts, eras, type ClassicText } from '../lib/classics';
import { loadOpenings, openingFor, type Openings } from '../lib/openings';
import { play, soundFor } from '../lib/sound';

export type ClassicGame = { id: string; source?: string; link?: string; white: string; black: string; event: string; site: string; date: string; result: string; depth: number; sans: string[]; cp: number[]; mate: (number | null)[]; best: string[] };
const START = new Chess().fen();
const lastName = (n: string) => n.split(',')[0].replace(/^(Von|Van|De) /i, '').trim();
const year = (g: ClassicGame) => g.date.slice(0, 4);
const resultText = (r: string) => r === '1-0' ? 'White won' : r === '0-1' ? 'Black won' : 'Draw';
const eventLabel = (g: ClassicGame) => g.event.replace(/ ?'.*'/, '').replace(/^World Championship (\d+)(st|nd|rd|th)(-KK\d)?$/, 'World Championship').replace(/^WCh (\d{4})$/, 'World Championship').replace(/^DSB-18\.Kongress$/, 'Breslau Congress').trim();

function Graph({ g, ply, onGo }: { g: ClassicGame; ply: number; onGo: (n: number) => void }) {
 const W = 360, H = 70, n = g.sans.length;
 const pts = g.cp.map((cp, i) => `${(i / n * W).toFixed(1)} ${(H - winPercent({ cp, depth: 0, best: '' }) / 100 * H).toFixed(1)}`);
 const line = pts.map((p, i) => (i ? 'L' : 'M') + p).join(' ');
 return <svg className="eval-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evaluation graph. Click to jump."
  onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onGo(Math.max(0, Math.min(n, Math.round((e.clientX - r.left) / r.width * n)))); }}>
  <rect width={W} height={H} fill="#403d39" /><path d={`${line} L${W} ${H} L0 ${H} Z`} fill="#f1f0ee" /><line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#8884" />
  <line x1={ply / n * W} x2={ply / n * W} y1="0" y2={H} stroke="#81b64c" strokeWidth="2" />
 </svg>;
}

function Viewer({ g, text, onBack, onAnalyze }: { g: ClassicGame; text?: ClassicText; onBack: () => void; onAnalyze: (pgn: string) => void }) {
 const [ply, setPly] = useState(0); const [playing, setPlaying] = useState(false); const [flipped, setFlipped] = useState(false);
 const [openings, setOpenings] = useState<Openings | null>(null);
 useEffect(() => { void loadOpenings().then(setOpenings).catch(() => {}); }, []);
 const data = useMemo(() => {
  const c = new Chess(); const moves = g.sans.map(s => c.move(s));
  const ev = (i: number) => ({ cp: g.cp[i], mate: g.mate[i] ?? undefined, best: g.best[i], depth: g.depth });
  const reviews = moves.map((m, i) => reviewMove(m, ev(i), ev(i + 1), i + 1));
  return { moves, classes: classifyGame(START, g.sans, reviews), fens: [START, ...moves.map(m => m.after)] };
 }, [g]);
 const n = g.sans.length; const fen = data.fens[ply]; const last = ply ? data.moves[ply - 1] : null;
 const cls = data.classes.get(ply);
 const badge = ply && cls && ['brilliant', 'great', 'blunder', 'mistake'].includes(cls) ? { square: data.moves[ply - 1].to, cls: cls as Cls } : null;
 const go = (k: number, sound = true) => { const t = Math.max(0, Math.min(n, k)); if (sound && t > ply && data.moves[t - 1]) play(soundFor(data.moves[t - 1], t === n && g.sans[t - 1].includes('#'))); setPly(t); };
 const timer = useRef<number | null>(null);
 useEffect(() => {
  if (!playing) return;
  timer.current = window.setInterval(() => setPly(p => { if (p >= n) { setPlaying(false); return p; } if (data.moves[p]) play(soundFor(data.moves[p], false)); return p + 1; }), 1300);
  return () => { if (timer.current) clearInterval(timer.current); };
 }, [playing, n, data]);
 useEffect(() => {
  const key = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') go(ply - 1, false); else if (e.key === 'ArrowRight') go(ply + 1); else if (e.key === 'Home') go(0, false); else if (e.key === 'End') go(n); else return; e.preventDefault(); };
  window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
 });
 const idxOf = (m: { side: 'w' | 'b'; move: number }) => (m.move - 1) * 2 + (m.side === 'w' ? 1 : 2);
 const moments = (text?.moments ?? []).map(m => ({ ...m, ply: idxOf(m) })).filter(m => g.sans[m.ply - 1] === m.san);
 const opening = openingFor(openings, data.fens, ply);
 const rows = Math.ceil(n / 2);
 const pgn = () => { const c = new Chess(); g.sans.forEach(s => c.move(s)); c.setHeader('White', g.white); c.setHeader('Black', g.black); c.setHeader('Event', g.event); c.setHeader('Site', g.site); c.setHeader('Date', g.date); c.setHeader('Result', g.result); return c.pgn(); };
 const turn = (new Chess(fen).turn());

 return <div className="training-layout classic-layout">
  <section className="board-column">
   <div className="player-row"><div className="avatar bot-avatar">{lastName(flipped ? g.white : g.black)[0]}</div><div><strong>{flipped ? g.white : g.black}</strong><small>{flipped ? 'White' : 'Black'}</small></div></div>
   <div className="board-wrap"><Board fen={fen} flipped={flipped} selected={null} legal={[]} lastMove={last ? { from: last.from, to: last.to } : null} badge={badge}
    canDrag={() => false} onSquare={() => {}} onDragStart={() => {}} onDrop={() => {}} /></div>
   <div className="player-row human"><div className="avatar human-avatar">{lastName(flipped ? g.black : g.white)[0]}</div><div><strong>{flipped ? g.black : g.white}</strong><small>{flipped ? 'Black' : 'White'}</small></div></div>
   <div className="board-toolbar"><div className="replay">
    <button aria-label="First position" onClick={() => go(0, false)}><ChevronsLeft size={18} /></button>
    <button aria-label="Previous move" onClick={() => go(ply - 1, false)}><ChevronLeft size={18} /></button>
    <button aria-label={playing ? 'Pause' : 'Play the game'} onClick={() => { if (ply >= n) setPly(0); setPlaying(!playing); }}>{playing ? <Pause size={18} /> : <Play size={18} />}<span>{playing ? 'Pause' : 'Play'}</span></button>
    <button aria-label="Next move" onClick={() => go(ply + 1)}><ChevronRight size={18} /></button>
    <button aria-label="Last position" onClick={() => go(n)}><ChevronsRight size={18} /></button>
    <span>{ply} / {n}</span></div>
    <div className="toolbar-end"><button onClick={() => setFlipped(!flipped)}>Flip</button></div></div>
  </section>
  <aside className="coach-column">
   <section className="classic-card">
    <button className="text-action" onClick={onBack}><ArrowLeft size={14} />All games</button>
    <h2>{text?.title ?? `${lastName(g.white)} – ${lastName(g.black)}`}</h2>
    <p className="muted small">{g.white} vs {g.black} · {eventLabel(g)}, {g.site} {year(g)} · {resultText(g.result)} ({g.result})</p>
    {g.link && <p className="muted small"><a href={g.link} target="_blank" rel="noreferrer">View the original game on Chess.com ↗</a></p>}
    {text && <p className="classic-story">{text.story}</p>}
    {moments.length > 0 && <><h4>Key moments</h4><ul className="moments">{moments.map(m => <li key={m.ply} className={ply === m.ply ? 'on' : ''}><button onClick={() => go(m.ply)}><b>{m.move}{m.side === 'w' ? '.' : '…'} {m.san}</b> {m.note}</button></li>)}</ul></>}
    {text && <p className="classic-takeaway"><b>Remember:</b> {text.takeaway}</p>}
    <button className="secondary" onClick={() => onAnalyze(pgn())}><Microscope size={15} />Open in analysis board</button>
   </section>
   <section className="moves-card">
    <div className="section-top"><h2>Moves</h2><span>{opening ? `${opening[0]} ${opening[1]}` : `${rows} moves`}</span></div>
    <Graph g={g} ply={ply} onGo={go} />
    <div className="move-list">{Array.from({ length: rows }, (_, r) => <div className="move-row" key={r}><span>{r + 1}.</span>
     {[r * 2, r * 2 + 1].map(j => <button key={j} disabled={!g.sans[j]} className={ply === j + 1 ? 'current-move' : ''} onClick={() => go(j + 1, false)}>{g.sans[j] ?? '—'}{data.classes.get(j + 1) && ['brilliant', 'great', 'blunder', 'mistake'].includes(data.classes.get(j + 1)!) && <ClassBadge cls={data.classes.get(j + 1)!} />}</button>)}</div>)}</div>
    <p className="muted small" style={{ padding: '0 16px 12px' }}>{turn === 'w' ? 'White' : 'Black'} to move · engine ratings at depth {g.depth}</p>
   </section>
  </aside>
 </div>;
}

export default function Classics({ seen, onSeen, onAnalyze }: { seen: string[]; onSeen: (id: string) => void; onAnalyze: (pgn: string) => void }) {
 const [games, setGames] = useState<ClassicGame[] | null>(null); const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState('');
 useEffect(() => { fetch('/data/classics.json').then(r => r.json() as Promise<ClassicGame[]>).then(setGames).catch(() => setError('The classic games could not be loaded.')); }, []);
 const g = games?.find(x => x.id === open);
 if (error) return <p className="danger">{error}</p>; if (!games) return <p className="muted">Loading the classics…</p>;
 if (g) return <Viewer key={g.id} g={g} text={classicTexts[g.id]} onBack={() => setOpen(null)} onAnalyze={onAnalyze} />;
 const all = games.filter(x => classicTexts[x.id]).sort((a, b) => a.date.localeCompare(b.date));
 return <div className="classics">
  <p className="muted">Games every player should know: the sacrifices, the endgames and the matches that shaped chess. Replay them move by move with engine ratings and the key moments explained. {seen.filter(id => all.some(x => x.id === id)).length}/{all.length} watched.</p>
  {eras.map(era => { const list = all.filter(x => classicTexts[x.id].era === era.id); if (!list.length) return null;
   return <section key={era.id} className="lesson-group"><h2>{era.title}</h2><p className="muted small">{era.blurb}</p>
    <div className="lesson-grid">{list.map(x => { const t = classicTexts[x.id]; return <button key={x.id} className="lesson-tile" onClick={() => { setOpen(x.id); onSeen(x.id); }}>
     <strong>{t.title}{seen.includes(x.id) && <Check size={15} className="tick" aria-label="Watched" />}</strong>
     <span>{lastName(x.white)} – {lastName(x.black)}, {eventLabel(x)} {year(x)}</span><span>{t.tagline}</span><small>{Math.ceil(x.sans.length / 2)} moves · {x.result}</small></button>; })}</div></section>; })}
 </div>;
}
