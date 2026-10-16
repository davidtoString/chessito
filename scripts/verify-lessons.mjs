// Dev tool: checks every lesson task against a real Stockfish binary.
// Usage: STOCKFISH=/usr/games/stockfish node --experimental-strip-types scripts/verify-lessons.mjs [lessonId...]
import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';
import { lessons } from '../lib/lessons.ts';

const sf = spawn(process.env.STOCKFISH || '/usr/games/stockfish');
let buf = '', waiter = null;
sf.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); waiter?.(line); } });
const send = s => sf.stdin.write(s + '\n');
const until = pred => new Promise(res => { const prev = waiter; const lines = []; waiter = l => { lines.push(l); if (pred(l)) { waiter = prev; res(lines); } }; });

async function lines(fen, multipv = 6, depth = 16) {
 send(`setoption name MultiPV value ${multipv}`); send(`position fen ${fen}`);
 const p = until(l => l.startsWith('bestmove')); send(`go depth ${depth}`);
 const out = new Map();
 for (const l of await p) {
  const m = l.match(/^info .*?depth (\d+) .*?multipv (\d+) .*?score (cp|mate) (-?\d+).*? pv (\S+)/);
  if (m && !/bound/.test(l)) out.set(+m[2], { depth: +m[1], score: m[3] === 'mate' ? (+m[4] > 0 ? 100000 - +m[4] * 100 : -100000 - +m[4] * 100) : +m[4], mate: m[3] === 'mate' ? +m[4] : null, move: m[5] });
 }
 return [...out.values()];
}
send('uci'); await until(l => l === 'uciok'); send('isready'); await until(l => l === 'readyok');

const only = process.argv.slice(2); let problems = 0, checked = 0;
for (const lesson of lessons) {
 if (only.length && !only.includes(lesson.id)) continue;
 for (const [si, step] of lesson.steps.entries()) {
  if (!step.task || step.task.rule) continue;
  const g = new Chess(step.fen); for (const m of step.setup ?? []) g.move(m);
  for (const [ti, item] of step.task.seq.entries()) {
   const u = x => g.move({ from: x.slice(0, 2), to: x.slice(2, 4), promotion: x[4] });
   if ('auto' in item) { u(item.auto); continue; }
   const ls = await lines(g.fen()); checked++;
   const best = ls[0], tag = `${lesson.id}#${si + 1}.${ti}`;
   for (const a of item.accept) {
    const hit = ls.find(l => l.move === a);
    let score;
    if (hit) score = hit.score; else { const x = new Chess(g.fen()); x.move({ from: a.slice(0, 2), to: a.slice(2, 4), promotion: a[4] }); const r = await lines(x.fen(), 1); score = -(r[0]?.score ?? 0); }
    const bad = best.score - score > 60 && !(best.score > 600 && score > 600);
    if (bad) { problems++; console.log(`PROBLEM ${tag} accepts ${a}: ${score} vs best ${best.move} ${best.score}`); }
   }
   const missed = ls.filter(l => !item.accept.includes(l.move) && best.score - l.score <= 25 && !(step.task.ends !== 'mate' && best.score > 600 && l.score > 600));
   if (missed.length) console.log(`note ${tag}: also strong, not accepted: ${missed.map(m => m.move + '(' + m.score + ')').join(' ')}; best ${best.move}`);
   u(item.accept[0]);
  }
 }
}
console.log(`checked ${checked} learner moves, ${problems} problems`);
sf.kill();
