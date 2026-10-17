'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Check, ChevronLeft, ChevronRight, Eye, RotateCcw, ArrowLeft, Lightbulb } from 'lucide-react';
import Board from './board';
import Classics from './classics';
import { lessons, categories, type Lesson, type Step, type Quiz } from '../lib/lessons';
import { play, soundFor } from '../lib/sound';

export type LearnProgress = { lessons: string[]; openings: Record<string, { clean: number; runs: number }>; quizzes?: Record<string, number>; games?: string[] };
export const emptyLearn: LearnProgress = { lessons: [], openings: {}, quizzes: {} };
export type OpeningLine = { id: string; family: string; side: 'w' | 'b'; eco: string; name: string; pgn: string; plies: number };
type Props = { progress: LearnProgress; onProgress: (p: LearnProgress) => void; drills: React.ReactNode; onAnalyze: (pgn: string) => void };

const START = new Chess().fen();
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Shared move-by-move board for lessons and the opening trainer.
function useBoard(initialFen: string) {
 const game = useRef(new Chess(initialFen));
 const [fen, setFen] = useState(initialFen);
 const [last, setLast] = useState<{ from: string; to: string } | null>(null);
 const [selected, setSelected] = useState<Square | null>(null);
 const reset = (f: string, moves: string[] = []) => { game.current = new Chess(f); for (const m of moves) game.current.move(m); setFen(game.current.fen()); setLast(null); setSelected(null); };
 const move = (m: { from: string; to: string; promotion?: string } | string) => {
  const r = game.current.move(m as never); setFen(game.current.fen()); setLast({ from: r.from, to: r.to }); setSelected(null);
  play(soundFor(r, game.current.isGameOver())); return r;
 };
 return { game, fen, last, selected, setSelected, reset, move };
}

function QuizView({ quiz, title, onDone, onBack }: { quiz: Quiz[]; title: string; onDone: (percent: number) => void; onBack: () => void }) {
 const [i, setI] = useState(0);
 const [picked, setPicked] = useState<number | null>(null);
 const [right, setRight] = useState(0);
 const [finished, setFinished] = useState(false);
 const q = quiz[i];
 const pct = Math.round(right / quiz.length * 100);
 if (finished) return <section className="quiz-card"><h2>{title}: quiz</h2><p className="quiz-score">{right} / {quiz.length}</p><p className="muted">{pct === 100 ? 'Perfect.' : pct >= 50 ? 'Good. Review the lesson to lock it in.' : 'Worth another look at the lesson.'}</p><div className="actions"><button className="primary" onClick={() => onDone(pct)}><Check size={15} />Finish</button><button className="secondary" onClick={onBack}>Back to lesson</button></div></section>;
 return <section className="quiz-card">
  <p className="muted small">{title} · question {i + 1} of {quiz.length}</p>
  <h2>{q.q}</h2>
  <div className="quiz-options">{q.options.map((o, n) => <button key={n} disabled={picked !== null} className={picked === null ? '' : n === q.answer ? 'right' : n === picked ? 'wrong' : ''} onClick={() => { setPicked(n); if (n === q.answer) setRight(r => r + 1); }}>{o}</button>)}</div>
  {picked !== null && <><p className={picked === q.answer ? 'lesson-msg ok' : 'lesson-msg'} role="status">{picked === q.answer ? 'Correct. ' : 'Not quite. '}{q.why}</p>
   <div className="actions"><button className="primary" onClick={() => { if (i + 1 >= quiz.length) setFinished(true); else { setI(i + 1); setPicked(null); } }}>{i + 1 >= quiz.length ? 'See score' : 'Next question'}<ChevronRight size={15} /></button></div></>}
 </section>;
}

function LessonPlayer({ lesson, done, onFinish, onBack }: { lesson: Lesson; done: boolean; onFinish: (score: number | null) => void; onBack: () => void }) {
 const [phase, setPhase] = useState<'steps' | 'quiz'>('steps');
 const [idx, setIdx] = useState(0);
 const step: Step = lesson.steps[idx];
 const b = useBoard(START);
 const [k, setK] = useState(0);
 const [msg, setMsg] = useState('');
 const [solved, setSolved] = useState(false);
 const [busy, setBusy] = useState(false);
 const alive = useRef(true);
 useEffect(() => () => { alive.current = false; }, []);

 const startFen = step.fen ?? START;
 useEffect(() => { b.reset(startFen, step.setup); setK(0); setMsg(''); setSolved(!step.task); setBusy(false); }, [idx, lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

 const flipped = useMemo(() => { if (!step.task) return false; const g = new Chess(startFen); for (const m of step.setup ?? []) g.move(m); return g.turn() === 'b'; }, [startFen, step]);
 const turnColor = b.game.current.turn();
 const legal = b.selected ? b.game.current.moves({ square: b.selected, verbose: true }) : [];

 async function runAutos(from: number) {
  let i = from; setBusy(true);
  while (alive.current && i < step.task!.seq.length && 'auto' in step.task!.seq[i]) { await wait(550); b.move({ from: (step.task!.seq[i] as { auto: string }).auto.slice(0, 2), to: (step.task!.seq[i] as { auto: string }).auto.slice(2, 4), promotion: (step.task!.seq[i] as { auto: string }).auto[4] }); i++; }
  setK(i); setBusy(false);
  if (i >= step.task!.seq.length) { setSolved(true); setMsg(step.task!.success); }
 }
 function attempt(from: string, to: string) {
  if (!step.task || busy || solved) return;
  const item = step.task.seq[k]; if (!item || !('accept' in item)) return;
  const g = new Chess(b.game.current.fen());
  let r; try { r = g.move({ from, to, promotion: 'q' }); } catch { b.setSelected(null); return; }
  const uciMove = from + to + (r.promotion ?? '');
  if (!item.accept.includes(uciMove) && !item.accept.includes(from + to)) { b.setSelected(null); setMsg('Not quite. ' + step.task.hint); return; }
  b.move({ from, to, promotion: r.promotion ?? 'q' }); setMsg(''); void runAutos(k + 1);
 }
 function click(s: Square) {
  if (!step.task || solved || busy) return;
  if (b.selected && legal.some(m => m.to === s)) { attempt(b.selected, s); return; }
  b.setSelected(b.game.current.get(s)?.color === turnColor ? s : null);
 }
 async function show() {
  if (!step.demo || busy) return; b.reset(startFen, step.setup); setBusy(true);
  for (const san of step.demo) { await wait(750); if (!alive.current) return; b.move(san); }
  setBusy(false);
 }
 const last = idx === lesson.steps.length - 1;
 if (phase === 'quiz' && lesson.quiz) return <QuizView quiz={lesson.quiz} title={lesson.title} onDone={onFinish} onBack={() => setPhase('steps')} />;
 const progressDots = lesson.steps.map((_, i) => <span key={i} className={i === idx ? 'dot on' : i < idx ? 'dot done' : 'dot'} />);

 return <div className="training-layout lesson-layout">
  <section className="board-column"><div className="board-wrap">
   <Board fen={b.fen} flipped={flipped} selected={b.selected} legal={legal} lastMove={b.last} arrows={(step.arrows ?? []).map(([from, to]) => ({ from, to }))} highlights={step.marks}
    canDrag={sq => !!step.task && !solved && !busy && b.game.current.get(sq)?.color === turnColor}
    onSquare={click} onDragStart={sq => b.setSelected(sq)} onDrop={(f, t) => attempt(f, t)} />
  </div></section>
  <aside className="coach-column">
   <section className="lesson-card">
    <button className="text-action" onClick={onBack}><ArrowLeft size={14} />All lessons</button>
    <h2>{lesson.title}</h2>
    <div className="dots" aria-label={`Step ${idx + 1} of ${lesson.steps.length}`}>{progressDots}</div>
    <p className="lesson-text">{step.text}</p>
    {msg && <p className={solved ? 'lesson-msg ok' : 'lesson-msg'} role="status">{msg}</p>}
    {step.task && !solved && <p className="muted small">Your turn: make the move on the board.</p>}
    <div className="actions">
     {step.demo && <button className="secondary" disabled={busy} onClick={() => void show()}><Eye size={15} />Show me</button>}
     {step.task && !solved && <button className="secondary" onClick={() => setMsg(step.task!.hint)}><Lightbulb size={15} />Hint</button>}
     {(step.demo || step.task) && <button className="secondary" disabled={busy} onClick={() => { b.reset(startFen, step.setup); setK(0); setMsg(''); setSolved(!step.task); }}><RotateCcw size={15} />Reset</button>}
    </div>
    <div className="lesson-nav">
     <button className="secondary" disabled={idx === 0 || busy} onClick={() => setIdx(idx - 1)}><ChevronLeft size={15} />Back</button>
     {last ? <button className="primary" disabled={!solved || busy} onClick={() => lesson.quiz?.length ? setPhase('quiz') : onFinish(null)}><Check size={15} />{lesson.quiz?.length ? 'Take the quiz' : done ? 'Done' : 'Finish lesson'}</button>
      : <button className="primary" disabled={!solved || busy} onClick={() => setIdx(idx + 1)}>Next<ChevronRight size={15} /></button>}
    </div>
   </section>
  </aside>
 </div>;
}

function OpeningTrainer({ line, onResult, onBack, onNext }: { line: OpeningLine; onResult: (clean: boolean) => void; onBack: () => void; onNext: () => void }) {
 const c = useMemo(() => { const g = new Chess(); g.loadPgn(line.pgn); return g.history({ verbose: true }); }, [line]);
 const b = useBoard(START);
 const [ply, setPly] = useState(0);
 const [mistakes, setMistakes] = useState(0);
 const [revealed, setRevealed] = useState(false);
 const [msg, setMsg] = useState('');
 const [finished, setFinished] = useState(false);
 const [busy, setBusy] = useState(false);
 const alive = useRef(true);
 useEffect(() => () => { alive.current = false; }, []);
 const userColor = line.side;

 async function advance(from: number) {
  let i = from; setBusy(true);
  while (alive.current && i < c.length && c[i].color !== userColor) { await wait(500); b.move(c[i].san); i++; }
  setPly(i); setBusy(false);
  if (i >= c.length) { setFinished(true); onResult(mistakes === 0 && !revealed); setMsg(mistakes === 0 && !revealed ? 'Perfect. You played the whole line from memory.' : 'Line complete. Run it again without hints for a clean finish.'); }
 }
 function restart() { b.reset(START); setMistakes(0); setRevealed(false); setMsg(''); setFinished(false); setPly(0); void advance(0); }
 useEffect(() => { restart(); }, [line.id]); // eslint-disable-line react-hooks/exhaustive-deps

 const legal = b.selected ? b.game.current.moves({ square: b.selected, verbose: true }) : [];
 function attempt(from: string, to: string) {
  if (busy || finished || ply >= c.length || c[ply].color !== userColor) return;
  const want = c[ply];
  if (from === want.from && to === want.to) { b.move({ from, to, promotion: want.promotion }); setMsg(''); void advance(ply + 1); return; }
  b.setSelected(null); setMistakes(m => m + 1); setMsg('Not the book move here. Think about what this opening is trying to do, or use Hint.');
 }
 function click(s: Square) {
  if (busy || finished) return;
  if (b.selected && legal.some(m => m.to === s)) { attempt(b.selected, s); return; }
  b.setSelected(b.game.current.get(s)?.color === userColor ? s : null);
 }
 const want = !finished && ply < c.length ? c[ply] : null;
 const arrows = revealed && want ? [{ from: want.from, to: want.to }] : [];

 return <div className="training-layout lesson-layout">
  <section className="board-column"><div className="board-wrap">
   <Board fen={b.fen} flipped={userColor === 'b'} selected={b.selected} legal={legal} lastMove={b.last} arrows={arrows}
    canDrag={sq => !busy && !finished && b.game.current.get(sq)?.color === userColor}
    onSquare={click} onDragStart={sq => b.setSelected(sq)} onDrop={(f, t) => attempt(f, t)} />
  </div></section>
  <aside className="coach-column"><section className="lesson-card">
   <button className="text-action" onClick={onBack}><ArrowLeft size={14} />All openings</button>
   <h2>{line.name}</h2>
   <p className="muted small">{line.eco} · you play {userColor === 'w' ? 'White' : 'Black'} · move {Math.min(Math.floor(ply / 2) + 1, Math.ceil(c.length / 2))} of {Math.ceil(c.length / 2)}</p>
   <p className="lesson-text">{finished ? msg : busy ? 'Opponent is moving…' : 'Play the next move of the line from memory.'}</p>
   {!finished && msg && <p className="lesson-msg" role="status">{msg}</p>}
   <div className="actions">
    {!finished && <button className="secondary" disabled={busy} onClick={() => { setRevealed(true); setMsg(`Book move: ${want?.san}`); }}><Lightbulb size={15} />Hint</button>}
    <button className="secondary" disabled={busy} onClick={restart}><RotateCcw size={15} />Restart</button>
    {finished && <button className="primary" onClick={onNext}>Next line<ChevronRight size={15} /></button>}
   </div>
  </section></aside>
 </div>;
}

export default function Learn({ progress, onProgress, drills, onAnalyze }: Props) {
 const [tab, setTab] = useState<'lessons' | 'classics' | 'openings' | 'drills'>('lessons');
 const [lessonId, setLessonId] = useState<string | null>(null);
 const [review, setReview] = useState<Lesson | null>(null);
 const [lines, setLines] = useState<OpeningLine[] | null>(null);
 const [lineId, setLineId] = useState<string | null>(null);
 const [family, setFamily] = useState<string | null>(null);
 useEffect(() => { if (tab === 'openings' && !lines) fetch('/data/lines.json').then(r => r.json() as Promise<OpeningLine[]>).then(setLines).catch(() => setLines([])); }, [tab, lines]);

 const lesson = review ?? lessons.find(l => l.id === lessonId);
 function startReview() {
  const pool = lessons.filter(l => progress.lessons.includes(l.id)).flatMap(l => l.steps.filter(st => st.task && !st.task.rule).map(st => ({ ...st, text: `${l.title}: ${st.text}` })));
  const picked = [...pool].sort(() => Math.random() - .5).slice(0, 5);
  if (picked.length) setReview({ id: 'review', category: 'Basics', title: 'Quick review', summary: '', steps: picked });
 }
 const line = lines?.find(l => l.id === lineId);
 const families = useMemo(() => { const m = new Map<string, OpeningLine[]>(); for (const l of lines ?? []) m.set(l.family, [...(m.get(l.family) ?? []), l]); return [...m.entries()]; }, [lines]);

 if (lesson) return <LessonPlayer key={lesson.id} lesson={lesson} done={progress.lessons.includes(lesson.id)} onBack={() => { setLessonId(null); setReview(null); }}
  onFinish={score => { if (!review) { const quizzes = { ...(progress.quizzes ?? {}) }; if (score !== null) quizzes[lesson.id] = Math.max(quizzes[lesson.id] ?? 0, score); onProgress({ ...progress, lessons: progress.lessons.includes(lesson.id) ? progress.lessons : [...progress.lessons, lesson.id], quizzes }); } setLessonId(null); setReview(null); }} />;
 if (line) {
  const siblings = lines!.filter(l => l.family === line.family); const next = siblings[(siblings.indexOf(line) + 1) % siblings.length];
  return <OpeningTrainer key={line.id} line={line} onBack={() => setLineId(null)} onNext={() => setLineId(next.id)}
   onResult={clean => { const p = progress.openings[line.id] ?? { clean: 0, runs: 0 }; onProgress({ ...progress, openings: { ...progress.openings, [line.id]: { clean: p.clean + (clean ? 1 : 0), runs: p.runs + 1 } } }); }} />;
 }

 return <div className="learn">
  <div className="learn-tabs" role="tablist">
   {(['lessons', 'classics', 'openings', 'drills'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'lessons' ? `Lessons ${progress.lessons.length}/${lessons.length}` : t === 'classics' ? 'Classic games' : t === 'openings' ? 'Openings' : 'Drills'}</button>)}
  </div>
  {tab === 'lessons' && progress.lessons.length > 0 && <div className="review-bar"><span>Practise what you have learned</span><button className="secondary" onClick={startReview}>Quick review</button></div>}
  {tab === 'lessons' && categories.map(cat => <section key={cat} className="lesson-group"><h2>{cat}</h2>
   <div className="lesson-grid">{lessons.filter(l => l.category === cat).map(l => <button key={l.id} className="lesson-tile" onClick={() => setLessonId(l.id)}>
    <strong>{l.title}{progress.lessons.includes(l.id) && <Check size={15} className="tick" aria-label="Completed" />}</strong><span>{l.summary}</span><small>{l.steps.length} step{l.steps.length === 1 ? '' : 's'}{progress.quizzes?.[l.id] !== undefined && ` · quiz ${progress.quizzes[l.id]}%`}</small></button>)}</div></section>)}
  {tab === 'openings' && (!lines ? <p className="muted">Loading openings…</p> : <>
   <p className="muted">Pick an opening and play your side of the line from memory. Lines come from the Lichess opening database.</p>
   {(['w', 'b'] as const).map(side => <section key={side} className="lesson-group"><h2>{side === 'w' ? 'Play as White' : 'Play as Black'}</h2>
    <div className="lesson-grid">{families.filter(([, ls]) => ls[0].side === side).map(([fam, ls]) => {
     const clean = ls.reduce((n, l) => n + ((progress.openings[l.id]?.clean ?? 0) > 0 ? 1 : 0), 0);
     return <div key={fam} className="lesson-tile static"><strong>{fam}</strong><small>{clean}/{ls.length} lines learned</small>
      <div className="line-list">{(family === fam ? ls : ls.slice(0, 0)).map(l => <button key={l.id} onClick={() => setLineId(l.id)}>{l.name.replace(fam + ': ', '').replace(fam, 'Main line')}{(progress.openings[l.id]?.clean ?? 0) > 0 && <Check size={13} />}</button>)}</div>
      <button className="secondary" onClick={() => setFamily(family === fam ? null : fam)}>{family === fam ? 'Hide lines' : 'Choose a line'}</button></div>;
    })}</div></section>)}</>)}
  {tab === 'classics' && <Classics seen={progress.games ?? []} onSeen={id => { if (!(progress.games ?? []).includes(id)) onProgress({ ...progress, games: [...(progress.games ?? []), id] }); }} onAnalyze={onAnalyze} />}
  {tab === 'drills' && drills}
 </div>;
}
