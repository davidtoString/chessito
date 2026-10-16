import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { lessons, categories, type Step } from '../lib/lessons.ts';

const START = new Chess().fen();
const squares = /^[a-h][1-8]$/;

function position(step: Step) {
 const g = new Chess(step.fen ?? START);
 for (const san of step.setup ?? []) g.move(san);
 return g;
}
const uci = (g: Chess, u: string) => g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

test('lesson ids are unique and categories valid', () => {
 assert.equal(new Set(lessons.map(l => l.id)).size, lessons.length);
 for (const l of lessons) { assert.ok(categories.includes(l.category), l.id); assert.ok(l.steps.length >= 1 && l.title && l.summary, l.id); }
 assert.ok(lessons.length >= 50);
 for (const l of lessons) {
  assert.ok(l.quiz && l.quiz.length >= 1, `${l.id} needs a quiz`);
  for (const q of l.quiz!) { assert.ok(q.options.length >= 3 && q.options.length <= 4, l.id); assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, l.id); assert.equal(new Set(q.options).size, q.options.length, l.id); assert.ok(q.q && q.why, l.id); }
 }
});

for (const lesson of lessons) {
 lesson.steps.forEach((step, i) => {
  test(`${lesson.id} step ${i + 1}`, () => {
   assert.ok(step.text.length > 20);
   const g = position(step);
   for (const [a, b] of step.arrows ?? []) assert.ok(squares.test(a) && squares.test(b));
   for (const m of step.marks ?? []) assert.ok(squares.test(m));
   if (step.expect === 'stalemate') assert.ok(g.isStalemate(), 'expected stalemate');
   if (step.demo) {
    const d = new Chess(g.fen());
    for (const san of step.demo) d.move(san);
    if (step.demoEnds === 'mate') assert.ok(d.isCheckmate(), 'demo should end in mate');
   }
   if (step.task) {
    const t = new Chess(g.fen());
    assert.ok(step.task.seq.length >= 1 && step.task.hint && step.task.success);
    for (const m of step.task.seq) {
     if ('auto' in m) uci(t, m.auto);
     else { assert.ok(m.accept.length >= 1); for (const a of m.accept) uci(new Chess(t.fen()), a); uci(t, m.accept[0]); }
    }
    assert.ok('accept' in step.task.seq[0], 'the learner moves first');
    if (step.task.ends === 'mate') {
     // every accepted final move must mate
     const last = step.task.seq.at(-1)!; assert.ok('accept' in last);
     const before = new Chess(g.fen());
     for (const m of step.task.seq.slice(0, -1)) { if ('auto' in m) uci(before, m.auto); else uci(before, m.accept[0]); }
     for (const a of (last as { accept: string[] }).accept) { const x = new Chess(before.fen()); uci(x, a); assert.ok(x.isCheckmate(), `${a} should mate`); }
    }
   }
  });
 });
}
