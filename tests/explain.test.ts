import test from 'node:test';
import assert from 'node:assert/strict';
import { moveFacts, whyGood, whyBad, walkPv, compareMoves, scan, explainPuzzle, scoreFor } from '../lib/explain.ts';

test('fork is detected and explained', () => {
 const f = moveFacts('3q4/4k3/8/4N3/8/8/8/4K3 w - - 0 1', 'e5c6')!;
 assert.equal(f.fork, true);
 assert.ok(f.check);
 assert.match(whyGood(f).join(' '), /forks the/);
});

test('pin and skewer from a slider', () => {
 // Rook on a1 skewers the king on d8 against the rook on h8 after Ra8+.
 const s = moveFacts('3k3r/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8')!;
 assert.equal(s.skewers.length, 1);
 assert.match(whyGood(s).join(' '), /skewers/);
 // Bishop pinning a knight to the king.
 const p = moveFacts('4k3/3n4/8/8/8/8/8/B3K3 w - - 0 1', 'a1b2');
 assert.ok(p);
});

test('free capture vs protected capture', () => {
 const free = moveFacts('4k3/8/8/2b5/8/8/8/2Q1K3 w - - 0 1', 'c1c5')!;
 assert.equal(free.free, true);
 assert.match(whyGood(free)[0], /wins a bishop for nothing/);
 const trap = moveFacts('4k3/3p4/8/8/8/8/3Q4/4K3 w - - 0 1', 'd2d7')!;
 assert.equal(trap.captured, 'p');
 assert.equal(trap.hangs, true);
 assert.match(whyBad(trap).join(' '), /simply be captured/);
});

test('moving into an attack and leaving a piece hanging', () => {
 const hang = moveFacts('4k3/8/8/3p4/8/8/8/4KQ2 w - - 0 1', 'f1f5')!;
 assert.equal(hang.hangs, false);
 const bad = moveFacts('4k3/4p3/8/8/8/8/8/4KQ2 w - - 0 1', 'f1f6')!;
 assert.equal(bad.hangs, true);
});

test('walkPv counts material and finds mate', () => {
 const w = walkPv('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', ['a1a8']);
 assert.equal(w.mate, true);
 assert.equal(w.matedSide, 'them');
 const loss = walkPv('4k3/3p4/8/8/8/8/3Q4/4K3 w - - 0 1', ['d2d7', 'e8d7']);
 assert.equal(loss.swing, 1 - 9);
 assert.equal(loss.firstReply?.captured, 'q');
});

test('compareMoves explains why the better move wins', () => {
 const fen = '4k3/3p4/8/8/8/8/3Q4/4K3 w - - 0 1';
 const c = compareMoves(fen, { pv: ['d2d6'], cp: 800 }, { pv: ['d2d7', 'e8d7'], cp: -100 }, { playedByUser: true });
 assert.match(c.headline, /Qd6 is better than Qxd7\+/);
 assert.ok(c.worse.some(x => /queen/.test(x)));
 assert.ok(c.habit.length >= 1);
});

test('scoreFor handles side and mate', () => {
 assert.equal(scoreFor({ pv: [], cp: 150 }, 'w'), 1.5);
 assert.equal(scoreFor({ pv: [], cp: 150 }, 'b'), -1.5);
 assert.ok(scoreFor({ pv: [], cp: 10000, mate: 2 }, 'w') > 90);
});

test('scan lists checks, captures and threats', () => {
 const s = scan('r3k3/8/8/8/8/8/8/R3K3 w - - 0 1');
 assert.ok(s.captures.some(c => c.san === 'Rxa8+'));
 assert.ok(s.checks.includes('Rxa8+'));
 const t = scan('4k3/8/8/8/8/2n5/8/R3K3 w - - 0 1');
 assert.ok(Array.isArray(t.threats));
});

test('explainPuzzle narrates the solution', () => {
 // Opponent blunders; the solution is a knight fork.
 const ex = explainPuzzle('3q4/4k1p1/8/4N3/8/8/8/4K3 b - - 0 1', 'g7g6 e5c6', 'fork short');
 assert.equal(ex.steps.length, 2);
 assert.equal(ex.steps[1].yours, true);
 assert.match(ex.steps[1].lines.join(' '), /forks/);
 assert.ok(ex.ideas.some(x => /fork/i.test(x)));
});

test('mating moves are explained without noise, and a missed mate is named', () => {
 const f = moveFacts('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8')!;
 assert.deepEqual(whyGood(f), ['It is checkmate.']);
 const c = compareMoves('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', { pv: ['a1a8'], cp: 10000, mate: 1 }, { pv: ['a1a2', 'g8f8'], cp: 0 });
 assert.ok(c.worse.some(x => /gives up the forced checkmate/.test(x)));
});
