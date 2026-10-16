'use client';
import { useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { LoaderCircle } from 'lucide-react';
import type { Engine, EngineLine } from '../lib/engine';
import { explainPuzzle, scan, moveFacts, compareMoves, lineText, walkPv, type Comparison, type PvLine } from '../lib/explain';
import { isSolutionMove, type Puzzle } from '../lib/puzzles';
import { AiExplain, lineAfter, type Ask } from './why-panel';

type Props = { puzzle: Puzzle; engine: Engine | null; ready: boolean; ask: Ask; cands: { from: string; to: string }[]; userColor: 'w' | 'b' };
type Verdict = { san: string; ok: boolean; why: string[] };
type Alt = { san: string; cmp: Comparison };

async function topLines(engine: Engine, fen: string, n = 3, depth = 16): Promise<EngineLine[]> {
 let latest: EngineLine[] = [];
 const run = engine.analyzeLines(fen, n, depth, ls => { latest = ls; });
 await run.done; return latest;
}
const toLine = (l: EngineLine): PvLine => ({ pv: l.pv, cp: l.cp, mate: l.mate });
const candUci = (fen: string, c: { from: string; to: string }) => { const p = new Chess(fen).get(c.from as Square); return c.from + c.to + (p?.type === 'p' && (c.to[1] === '8' || c.to[1] === '1') ? 'q' : ''); };

export default function PuzzleExplain({ puzzle, engine, ready, ask, cands, userColor }: Props) {
 const p1 = useMemo(() => { const g = new Chess(puzzle.fen); const [first, ...sol] = puzzle.moves.split(' '); g.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] }); return { fen: g.fen(), sol }; }, [puzzle]);
 const ex = useMemo(() => explainPuzzle(puzzle.fen, puzzle.moves, puzzle.themes), [puzzle]);
 const sc = useMemo(() => scan(p1.fen), [p1]);
 const key = useMemo(() => moveFacts(p1.fen, p1.sol[0]), [p1]);
 const [alts, setAlts] = useState<Alt[] | null>(null);
 const [verdicts, setVerdicts] = useState<Verdict[] | null>(cands.length ? null : []);
 const [busy, setBusy] = useState(false);

 useEffect(() => {
  if (!engine || !ready) return;
  let cancelled = false;
  (async () => {
   setBusy(true);
   try {
    const lines = await topLines(engine, p1.fen);
    if (cancelled || !lines.length) return;
    const match = lines.find(l => l.pv[0] === p1.sol[0]);
    const sol: PvLine = match ? toLine(match) : { pv: p1.sol, cp: lines[0].cp, mate: lines[0].mate };
    setAlts(lines.filter(l => l.pv[0] !== p1.sol[0]).slice(0, 2).map(l => ({ san: moveFacts(p1.fen, l.pv[0])?.san ?? l.pv[0], cmp: compareMoves(p1.fen, sol, toLine(l)) })));
    const out: Verdict[] = [];
    for (const c of cands) {
     const u = candUci(p1.fen, c); const f = moveFacts(p1.fen, u); if (!f) continue;
     if (isSolutionMove(p1.fen, p1.sol[0], c.from, c.to)) { out.push({ san: f.san, ok: true, why: ['This is the solution move.'] }); continue; }
     const hit = lines.find(l => l.pv[0] === u);
     const line = hit ? toLine(hit) : await lineAfter(engine, p1.fen, u);
     if (cancelled) return;
     out.push({ san: f.san, ok: false, why: compareMoves(p1.fen, sol, line).worse });
    }
    if (!cancelled) setVerdicts(out);
   } catch { /* explanations are optional */ } finally { if (!cancelled) setBusy(false); }
  })();
  return () => { cancelled = true; };
 }, [engine, ready, p1, cands]);

 const keyKind = key?.mate ? 'a checkmate' : key?.check ? 'a check' : key?.captured ? 'a capture' : 'a quiet move';
 const context = { fen: p1.fen, userColor, solution: ex.steps.map(s => s.san), ideas: ex.ideas, solutionMoveIs: keyKind, checks: sc.checks, captures: sc.captures.map(c => c.san), threats: sc.threats, steps: ex.steps.map(s => ({ move: s.san, yours: s.yours, why: s.lines })), alternatives: (alts ?? []).map(a => ({ move: a.san, why: a.cmp.worse, line: a.cmp.lineWorse })), candidates: (verdicts ?? []).map(v => ({ move: v.san, ok: v.ok, why: v.why })) };

 return <section className="puzzle-explain" aria-label="Why the solution works">
  <h3>Why it works</h3>
  {cands.length > 0 && <><h4>Your candidate moves</h4>
   {verdicts === null ? <p className="muted small"><LoaderCircle size={13} className="spin" /> Checking your candidates…</p> :
    <ul>{verdicts.map((v, i) => <li key={i}><b>{v.san}</b> {v.ok ? '✓ found it.' : '✗ ' + v.why[0]}</li>)}</ul>}</>}
  <h4>1. Scan: checks, captures, threats</h4>
  <ul>
   <li><b>Checks:</b> {sc.checks.length ? sc.checks.join(', ') : 'none'}</li>
   <li><b>Captures:</b> {sc.captures.length ? sc.captures.map(c => c.san + (c.safe ? '' : ' (unsafe)')).join(', ') : 'none'}</li>
   <li><b>Threats against you:</b> {sc.threats.length ? sc.threats.join(', ') : 'none found'}</li>
  </ul>
  <p className="muted small">The key move {key?.san} is {keyKind}.{keyKind === 'a quiet move' ? ' Quiet moves are easy to miss: ask what your opponent’s best reply would be.' : ' Forcing moves first: this is why checks and captures come before everything else.'}</p>
  <h4>2. The key idea</h4>
  {ex.ideas.length ? <ul>{ex.ideas.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="muted small">No labelled pattern: it is a calculation puzzle. Look for what the move forces.</p>}
  <h4>3. The solution, move by move</h4>
  <ol>{ex.steps.map((s, i) => <li key={i} className={s.yours ? 'yours' : ''}><b>{s.san}</b> {s.yours ? '(you)' : '(opponent)'}: {s.lines.join(' ')}</li>)}</ol>
  {ex.ends && <p className="muted small">{ex.ends} Line: {lineText(p1.fen, walkPv(p1.fen, p1.sol).sans)}</p>}
  <h4>4. Why not the other moves?</h4>
  {!ready ? <p className="muted small">Engine loading…</p> : alts === null ? <p className="muted small">{busy ? <><LoaderCircle size={13} className="spin" /> Comparing with the engine’s alternatives…</> : 'No comparison available.'}</p> :
   alts.length === 0 ? <p className="muted small">The engine sees no good alternative: the solution is the only move that works.</p> :
   <ul>{alts.map((a, i) => <li key={i}><b>{a.san}</b> {/wins and/.test(a.cmp.headline) ? 'does not work.' : 'is weaker.'} {a.cmp.worse.join(' ')}{a.cmp.lineWorse && <span className="why-line"> Line: {a.cmp.lineWorse}</span>}</li>)}</ul>}
  <AiExplain ask={ask} context={context} kind="puzzle" />
 </section>;
}
