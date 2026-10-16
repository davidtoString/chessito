'use client';
import { useState } from 'react';
import { Chess } from 'chess.js';
import { Sparkles, LoaderCircle, Search, HelpCircle } from 'lucide-react';
import type { Engine } from '../lib/engine';
import { compareMoves, moveFacts, whyGood, walkPv, scan, lineText, type Comparison, type PvLine, type Scan } from '../lib/explain';

export type Ask = ((context: unknown, kind: 'why' | 'puzzle' | 'scan') => Promise<string>) | null;

// Runs a single-line engine search and resolves with the final principal variation (White's perspective).
export async function lineFor(engine: Engine, fen: string, depth = 16): Promise<PvLine | null> {
 let last: PvLine | null = null;
 const run = engine.analyzeLines(fen, 1, depth, ls => { const l = ls[0]; if (l) last = { pv: l.pv, cp: l.cp, mate: l.mate }; });
 await run.done;
 return last;
}
export function playUci(fen: string, uci: string) {
 const g = new Chess(fen); const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); return { fen: g.fen(), san: m.san, over: g.isGameOver(), mate: g.isCheckmate(), mover: m.color };
}
// The line that starts with `uci`, completed by the engine's best continuation.
export async function lineAfter(engine: Engine, fen: string, uci: string): Promise<PvLine> {
 const next = playUci(fen, uci);
 if (next.over) return { pv: [uci], cp: next.mate ? (next.mover === 'w' ? 10000 : -10000) : 0 };
 const l = await lineFor(engine, next.fen);
 return { pv: [uci, ...(l?.pv ?? [])], cp: l?.cp ?? 0, mate: l?.mate };
}

export type Result = { cmp?: Comparison; good?: { san: string; reasons: string[]; line: string }; scan?: Scan };

export function ExplanationView({ result }: { result: Result }) {
 const { cmp, good, scan: sc } = result;
 return <div className="explanation">
  {cmp && <>
   <p className="why-head">{cmp.headline}</p>
   <h4>Why the better move works</h4><ul>{cmp.better.map((t, i) => <li key={i}>{t}</li>)}</ul>
   {cmp.lineBetter && <p className="why-line">Line: {cmp.lineBetter}</p>}
   <h4>Why the other move falls short</h4><ul>{cmp.worse.map((t, i) => <li key={i}>{t}</li>)}</ul>
   {cmp.lineWorse && <p className="why-line">Line: {cmp.lineWorse}</p>}
   {cmp.habit.length > 0 && <><h4>Habit to build</h4><ul>{cmp.habit.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
  </>}
  {good && <><p className="why-head">{good.san} is the move.</p><h4>Why it works</h4><ul>{good.reasons.map((t, i) => <li key={i}>{t}</li>)}</ul>{good.line && <p className="why-line">Line: {good.line}</p>}</>}
  {sc && <><h4>Checks, captures, threats</h4>
   <ul>
    <li><b>Checks:</b> {sc.checks.length ? sc.checks.join(', ') : 'none'}</li>
    <li><b>Captures:</b> {sc.captures.length ? sc.captures.map(c => c.san + (c.safe ? '' : ' (unsafe)')).join(', ') : 'none'}</li>
    <li><b>Threats against you:</b> {sc.threats.length ? sc.threats.join(', ') : 'none found'}</li>
    {sc.looseOwn.length > 0 && <li><b>Your loose pieces:</b> {sc.looseOwn.join(', ')}</li>}
    {sc.looseEnemy.length > 0 && <li><b>Their undefended pieces:</b> {sc.looseEnemy.join(', ')}</li>}
   </ul></>}
 </div>;
}

export function resultContext(fen: string, result: Result) {
 return { fen, ...(result.cmp ? { headline: result.cmp.headline, betterReasons: result.cmp.better, worseReasons: result.cmp.worse, habit: result.cmp.habit, betterLine: result.cmp.lineBetter, otherLine: result.cmp.lineWorse } : {}), ...(result.good ? { move: result.good.san, reasons: result.good.reasons, line: result.good.line } : {}), ...(result.scan ? { checks: result.scan.checks, captures: result.scan.captures, threats: result.scan.threats, looseOwn: result.scan.looseOwn, looseEnemy: result.scan.looseEnemy } : {}) };
}

export function AiExplain({ ask, context, kind }: { ask: Ask; context: unknown; kind: 'why' | 'puzzle' | 'scan' }) {
 const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
 if (!ask) return null;
 return <div className="ai-explanation-box">
  <button className="text-action" disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { setText(await ask(context, kind)); } catch (e) { setErr(e instanceof Error ? e.message : 'The AI coach could not answer.'); } finally { setBusy(false); } }}>
   {busy ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />} {text ? 'Explain again with AI' : 'Explain with AI'}</button>
  {err && <p className="danger small">{err}</p>}
  {text && <div className="ai-explanation"><span><Sparkles size={13} />AI explanation</span><p>{text}</p></div>}
 </div>;
}

type Props = { engine: Engine | null; ready: boolean; fen: string; played: string; best?: string; ask: Ask };

// "Why?" for a move already played: compares it with the engine's best move and explains the difference.
export default function WhyPanel({ engine, ready, fen, played, ask }: Props) {
 const [busy, setBusy] = useState(false);
 const [result, setResult] = useState<Result | null>(null);
 const [error, setError] = useState('');
 async function why() {
  if (!engine) return; setBusy(true); setError('');
  try {
   const best = await lineFor(engine, fen);
   if (!best) throw new Error('This position has no moves to compare.');
   if (best.pv[0] === played) {
    const f = moveFacts(fen, played)!; const w = walkPv(fen, best.pv);
    setResult({ good: { san: f.san, reasons: whyGood(f), line: lineText(fen, w.sans.slice(0, 6)) } });
   } else {
    const mine = await lineAfter(engine, fen, played);
    setResult({ cmp: compareMoves(fen, best, mine, { playedByUser: true }) });
   }
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not explain this move.'); } finally { setBusy(false); }
 }
 return <section className="why-panel">
  <div className="actions">
   <button className="secondary" disabled={!ready || busy} onClick={() => void why()}>{busy ? <LoaderCircle size={15} className="spin" /> : <HelpCircle size={15} />}Why?</button>
   <button className="secondary" onClick={() => setResult({ scan: scan(fen) })}><Search size={15} />Scan before the move</button>
  </div>
  {error && <p className="danger small">{error}</p>}
  {result && <><ExplanationView result={result} /><AiExplain ask={ask} context={resultContext(fen, result)} kind={result.scan ? 'scan' : 'why'} /></>}
 </section>;
}
