'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Lightbulb, SkipForward, ArrowRight, Eye, RotateCcw } from 'lucide-react';
import type { Engine } from '../lib/engine';
import PuzzleExplain from './puzzle-explain';
import type { Ask } from './why-panel';
import Board, { type Arrow } from './board';
import { play, soundFor } from '../lib/sound';
import { isSolutionMove, newRating, pickPuzzle, themeLabel, dailyPuzzle, nextDaily, todayKey, type Puzzle, type PuzzleStats } from '../lib/puzzles';

type Status = 'loading' | 'user' | 'solved' | 'revealed';
type Props = { stats: PuzzleStats; onStats: (s: PuzzleStats) => void; engine: Engine | null; ready: boolean; ask: Ask };

const THEME_KEYS = ['fork','pin','skewer','discoveredAttack','doubleCheck','backRankMate','smotheredMate','mateIn1','mateIn2','mateIn3','mateIn4','hangingPiece','trappedPiece','attraction','deflection','interference','clearance','quietMove','sacrifice','zugzwang','xRayAttack','capturingDefender','exposedKing','kingsideAttack','queensideAttack','advancedPawn','promotion','enPassant','defensiveMove','intermezzo','pawnEndgame','rookEndgame','bishopEndgame','knightEndgame','queenEndgame','opening','middlegame','endgame'].sort((a, b) => themeLabel(a).localeCompare(themeLabel(b)));
export default function PuzzlesRoom({ stats, onStats, engine, ready, ask }: Props) {
 const [all, setAll] = useState<Puzzle[] | null>(null);
 const [themed, setThemed] = useState<Record<string, Puzzle[]> | null>(null);
 const [set, setSet] = useState('rated');
 const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
 const [fen, setFen] = useState(new Chess().fen());
 const [last, setLast] = useState<{ from: string; to: string } | null>(null);
 const [step, setStep] = useState(0);
 const [status, setStatus] = useState<Status>('loading');
 const [selected, setSelected] = useState<Square | null>(null);
 const [message, setMessage] = useState('');
 const [hintLevel, setHintLevel] = useState(0);
 const [delta, setDelta] = useState<number | null>(null);
 const [error, setError] = useState('');
 const [think, setThink] = useState(false);
 const [thinking, setThinking] = useState(false);
 const [cands, setCands] = useState<{ from: string; to: string }[]>([]);
 const [noMissed, setNoMissed] = useState(false);
 const retrying = useRef(false), thinkRef = useRef(false), seenMissed = useRef(new Set<string>());
 thinkRef.current = think;
 const setRef = useRef(set); setRef.current = set;
 const failed = useRef(false), assisted = useRef(false), busy = useRef(false), timers = useRef<number[]>([]);
 const statsRef = useRef(stats); statsRef.current = stats;
 const uci = useMemo(() => puzzle?.moves.split(' ') ?? [], [puzzle]);
 const userColor = useMemo(() => puzzle ? (new Chess(puzzle.fen).turn() === 'w' ? 'b' : 'w') : 'w', [puzzle]);

 useEffect(() => { try { setThink(localStorage.getItem('chessito-think') === 'on'); } catch { /* optional */ } }, []);
 useEffect(() => { fetch('/data/puzzles.json').then(r => r.json() as Promise<Puzzle[]>).then(setAll).catch(() => setError('Puzzles could not be loaded.')); return () => timers.current.forEach(clearTimeout); }, []);
 useEffect(() => { if (set !== 'rated' && set !== 'daily' && !themed) fetch('/data/themed.json').then(r => r.json() as Promise<Record<string, Puzzle[]>>).then(setThemed).catch(() => setError('Themed puzzles could not be loaded.')); }, [set, themed]);
 const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

 function apply(g: Chess, u: string) {
  const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  setFen(g.fen()); setLast({ from: m.from, to: m.to }); play(soundFor(m, false)); return m;
 }
 function start(p: Puzzle, retry = false) {
  timers.current.forEach(clearTimeout); timers.current = [];
  failed.current = false; assisted.current = false; busy.current = true; retrying.current = retry;
  setPuzzle(p); setStatus('loading'); setSelected(null); setHintLevel(0); setDelta(null); setMessage(''); setLast(null); setFen(p.fen); setCands([]); setThinking(false); setNoMissed(false);
  later(() => { const g = new Chess(p.fen); apply(g, p.moves.split(' ')[0]); setStep(1); setStatus('user'); busy.current = false; if (thinkRef.current) { setThinking(true); setMessage('Think first: what are the checks, captures and threats? Click up to 3 candidate moves, then press Start solving.'); } }, 600);
 }
 function missedPool() { const byId = new Map<string, Puzzle>(); for (const p of all ?? []) byId.set(p.id, p); for (const list of Object.values(themed ?? {})) for (const p of list) byId.set(p.id, p); return (statsRef.current.missed ?? []).map(id => byId.get(id)).filter((p): p is Puzzle => !!p); }
 function next() {
  if (!all) return;
  const cur = setRef.current; const recent = statsRef.current.recent.map(r => r.id);
  if (cur === 'missed') { const pool = missedPool(); const p = pool.find(x => !seenMissed.current.has(x.id)) ?? (pool.length ? (seenMissed.current.clear(), pool[0]) : undefined); if (!p) { setPuzzle(null); setStatus('loading'); setNoMissed(true); return; } seenMissed.current.add(p.id); start(p, true); return; }
  const p = cur === 'daily' ? dailyPuzzle(all, todayKey()) : cur === 'rated' ? pickPuzzle(all, statsRef.current.rating, recent) : pickPuzzle(themed?.[cur] ?? [], statsRef.current.rating, recent); if (!p) return;
  start(p);
 }
 useEffect(() => { if (all && (set === 'rated' || set === 'daily' || themed)) { seenMissed.current.clear(); next(); } }, [all, set, themed]); // eslint-disable-line react-hooks/exhaustive-deps

 function record(ok: boolean) {
  if (!puzzle) return;
  if (retrying.current) { if (ok) onStats({ ...statsRef.current, missed: (statsRef.current.missed ?? []).filter(id => id !== puzzle.id) }); return; }
  if (setRef.current === 'daily') { if (ok) onStats({ ...statsRef.current, daily: nextDaily(statsRef.current.daily, todayKey()) }); return; }
  const s = statsRef.current, played = s.solved + s.failed;
  const rating = newRating(s.rating, puzzle.rating, ok, played);
  setDelta(rating - s.rating);
  const at = new Date().toISOString();
  onStats({ rating, solved: s.solved + (ok ? 1 : 0), failed: s.failed + (ok ? 0 : 1), streak: ok ? s.streak + 1 : 0, best: Math.max(s.best, rating),
   history: [...s.history, rating].slice(-100), recent: [...s.recent, { id: puzzle.id, ok, rating: puzzle.rating, at }].slice(-50),
   missed: ok ? (s.missed ?? []).filter(id => id !== puzzle.id) : [...new Set([...(s.missed ?? []), puzzle.id])].slice(-100) });
 }

 function attempt(from: string, to: string) {
  if (busy.current || status !== 'user' || !puzzle) return;
  const g = new Chess(fen); const expected = uci[step];
  if (g.get(from as Square)?.color !== userColor) return;
  if (thinking) {
   try { const m = g.move({ from, to, promotion: 'q' }); setSelected(null);
    setCands(c => c.some(x => x.from === from && x.to === to) || c.length >= 3 ? c : [...c, { from, to }]);
    setMessage(`Candidate: ${m.san}. Add up to 3, then press Start solving.`); } catch { setSelected(null); }
   return;
  }
  if (!isSolutionMove(fen, expected, from, to)) {
   try { g.move({ from, to, promotion: 'q' }); } catch { setSelected(null); return; } // illegal drops are ignored
   setSelected(null); setMessage('That’s not it. Try again.');
   if (!failed.current && !assisted.current) { failed.current = true; record(false); }
   return;
  }
  const m = g.move({ from, to, promotion: expected[4] || 'q' });
  setFen(g.fen()); setLast({ from: m.from, to: m.to }); setSelected(null); setHintLevel(0); play(soundFor(m, g.isCheckmate()));
  const done = step + 1 >= uci.length || g.isCheckmate();
  if (done) {
   setStatus('solved'); setMessage('Puzzle solved!');
   if (!failed.current && !assisted.current && status === 'user') record(true);
   return;
  }
  setMessage('Correct. Keep going.'); busy.current = true;
  later(() => { apply(g, uci[step + 1]); setStep(step + 2); busy.current = false; }, 500);
 }
 function clickSquare(s: Square) {
  const g = new Chess(fen);
  const legal = selected ? g.moves({ square: selected, verbose: true }) : [];
  if (selected && legal.some(m => m.to === s)) { attempt(selected, s); return; }
  setSelected(g.get(s)?.color === userColor ? s : null);
 }
 function hint() {
  if (status !== 'user') return; assisted.current = true;
  const level = hintLevel + 1; setHintLevel(level);
  const piece = new Chess(fen).get(uci[step].slice(0, 2) as Square);
  const names: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  setSelected(uci[step].slice(0, 2) as Square); setMessage(`Hint: move the ${names[piece?.type || 'p']}.`);
 }
 function reveal() {
  if (status !== 'user') return; assisted.current = true;
  if (!failed.current) { failed.current = true; record(false); }
  setStatus('revealed'); setHintLevel(2); setMessage('Here is the solution. Play it to finish.');
 }

 const board = useMemo(() => new Chess(fen), [fen]);
 const legal = selected ? board.moves({ square: selected, verbose: true }) : [];
 const showSolution = (status === 'revealed' || hintLevel >= 2) && uci[step];
 const arrows: Arrow[] = [...cands.map(c => ({ ...c, color: '#4b8bf5' })), ...(showSolution ? [{ from: uci[step].slice(0, 2), to: uci[step].slice(2, 4) }] : [])];
 const finished = status === 'solved';
 const themeKeys = themed ? Object.keys(themed).sort((a, b) => themeLabel(a).localeCompare(themeLabel(b))) : THEME_KEYS;
 const sparkline = stats.history.length > 1 ? stats.history : null;

 function revealedAttempt(from: string, to: string) {
  // After "Show solution" the player may still finish the puzzle; it is already scored as a miss.
  if (busy.current || !puzzle) return;
  const g = new Chess(fen); const expected = uci[step];
  if (g.get(from as Square)?.color !== userColor || !isSolutionMove(fen, expected, from, to)) { setSelected(null); return; }
  const m = g.move({ from, to, promotion: expected[4] || 'q' });
  setFen(g.fen()); setLast({ from: m.from, to: m.to }); setSelected(null); play(soundFor(m, g.isCheckmate()));
  if (step + 1 >= uci.length || g.isCheckmate()) { setStatus('solved'); setMessage('Solved with the solution shown.'); return; }
  busy.current = true; later(() => { apply(g, uci[step + 1]); setStep(step + 2); busy.current = false; }, 500);
 }
 const move = (from: string, to: string) => status === 'revealed' ? revealedAttempt(from, to) : attempt(from, to);

 if (error) return <section className="panel"><p className="danger">{error}</p></section>;
 return <div className="training-layout puzzle-layout">
  <section className="board-column">
   <div className="board-wrap"><Board fen={fen} flipped={userColor === 'b'} selected={selected} legal={legal} lastMove={last} arrows={arrows}
    canDrag={sq => status !== 'loading' && !finished && board.get(sq)?.color === userColor}
    onSquare={s => { if (status === 'revealed') { const g = new Chess(fen); const lg = selected ? g.moves({ square: selected, verbose: true }) : []; if (selected && lg.some(m => m.to === s)) revealedAttempt(selected, s); else setSelected(g.get(s)?.color === userColor ? s : null); } else clickSquare(s); }}
    onDragStart={sq => setSelected(sq)} onDrop={(f, t) => move(f, t)} /></div>
  </section>
  <aside className="coach-column">
   <section className="puzzle-card">
    <select className="puzzle-set" aria-label="Puzzle set" value={set} onChange={e => setSet(e.target.value)}>
     <option value="rated">Rated puzzles</option><option value="daily">Daily puzzle</option><option value="missed">Retry missed ({stats.missed?.length ?? 0})</option>
     <optgroup label="Practice by theme">{themeKeys.map(t => <option key={t} value={t}>{themeLabel(t)}</option>)}</optgroup>
    </select>
    <label className="think-toggle"><input type="checkbox" checked={think} onChange={e => { setThink(e.target.checked); try { localStorage.setItem('chessito-think', e.target.checked ? 'on' : 'off'); } catch { /* optional */ } }} /> Think first <small>name your candidate moves before playing</small></label>
    <div className="puzzle-rating">{set === 'daily' ? <><span>Daily streak</span><strong>{stats.daily?.streak ?? 0}</strong>{stats.daily?.date === todayKey() && <em className="plus">Done today</em>}</> : <><span>Puzzle rating</span><strong>{stats.rating}</strong>
     {delta !== null && <em className={delta >= 0 ? 'plus' : 'minus'}>{delta >= 0 ? '+' : ''}{delta}</em>}</>}</div>
    <p className="puzzle-turn">{noMissed ? 'No missed puzzles to retry.' : status === 'loading' ? 'Setting up…' : finished ? message : `${userColor === 'w' ? 'White' : 'Black'} to move`}</p>
    {!finished && status !== 'loading' && message && <p className="muted">{message}</p>}
    {finished && puzzle && <div className="puzzle-themes"><small>Puzzle {puzzle.id} · {puzzle.rating}</small>
     <div>{puzzle.themes.split(' ').filter(t => !['short', 'long', 'veryLong', 'oneMove'].includes(t)).slice(0, 4).map(t => <span key={t}>{themeLabel(t)}</span>)}</div></div>}
    <div className="actions">
     {thinking ? <>
      <button className="primary" onClick={() => { if (!cands.length) { setMessage('Add at least one candidate move first.'); return; } setThinking(false); setMessage('Now find the best move.'); }}>Start solving</button>
      <button className="secondary" disabled={!cands.length} onClick={() => setCands([])}>Clear</button>
      <button className="secondary" onClick={next}><SkipForward size={16} />Skip</button></> : (finished || status === 'revealed') ? <>
      {finished && <button className="primary" onClick={next}>Next puzzle<ArrowRight size={16} /></button>}
      <button className="secondary" onClick={() => puzzle && start(puzzle, true)}><RotateCcw size={16} />Retry (no rating change)</button>
      {!finished && <button className="secondary" onClick={next}><SkipForward size={16} />Skip</button>}</> : <>
      <button className="secondary" disabled={status !== 'user'} onClick={hint}><Lightbulb size={16} />Hint</button>
      <button className="secondary" disabled={status !== 'user'} onClick={reveal}><Eye size={16} />Solution</button>
      <button className="secondary" disabled={status === 'loading'} onClick={next}><SkipForward size={16} />Skip</button></>}
    </div>
   </section>
   {(finished || status === 'revealed') && puzzle && <PuzzleExplain key={puzzle.id + ':' + (finished ? 's' : 'r')} puzzle={puzzle} engine={engine} ready={ready} ask={ask} cands={cands} userColor={userColor} />}
   <section className="puzzle-stats">
    <div><strong>{stats.solved}</strong><span>Solved</span></div>
    <div><strong>{stats.failed}</strong><span>Missed</span></div>
    <div><strong>{stats.streak}</strong><span>Streak</span></div>
    <div><strong>{stats.best || stats.rating}</strong><span>Best</span></div>
    {sparkline && <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="spark" aria-label="Puzzle rating over time">
     {(() => { const lo = Math.min(...sparkline), hi = Math.max(...sparkline, lo + 1);
      return <polyline fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" points={sparkline.map((v, i) => `${i / (sparkline.length - 1) * 100},${28 - (v - lo) / (hi - lo) * 26}`).join(' ')} />; })()}
    </svg>}
   </section>
  </aside>
 </div>;
}
