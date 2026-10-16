import test from 'node:test';
import assert from 'node:assert/strict';
import { winPercent, moveAccuracy, gameAccuracy, classify, classifyGame, isSacrifice, winLoss } from '../lib/review.ts';
import type { ReviewMove, Evaluation } from '../lib/chess.ts';

const ev = (cp: number, best = 'e2e4'): Evaluation => ({ cp, best, depth: 12 });
const mv = (o: Partial<Omit<ReviewMove, 'before' | 'after'>> & { before: number; after: number }): ReviewMove => ({
 ply: 1, san: 'e4', color: 'w', bestSan: 'e4', loss: 0, label: '', advice: '', ...o, before: ev(o.before), after: ev(o.after),
});

test('win percent is symmetric and bounded', () => {
 assert.ok(Math.abs(winPercent(ev(0)) - 50) < 1e-9);
 assert.ok(winPercent(ev(300)) > 70 && winPercent(ev(300)) < 80);
 assert.ok(Math.abs(winPercent(ev(300)) + winPercent(ev(-300)) - 100) < 1e-9);
 assert.ok(winPercent(ev(100000)) < 100.0001);
});

test('move accuracy falls as win percentage is lost', () => {
 assert.ok(moveAccuracy(0) > 99.9);
 assert.ok(moveAccuracy(10) < moveAccuracy(2));
 assert.ok(moveAccuracy(80) >= 0);
});

test('winLoss is measured from the mover perspective', () => {
 assert.ok(winLoss(mv({ san: 'd4', before: 0, after: -300 })) > 20);
 assert.equal(winLoss(mv({ san: 'd4', color: 'b', before: 0, after: -300 })), 0);
 assert.ok(winLoss(mv({ san: 'd4', color: 'b', before: 0, after: 300 })) > 20);
});

test('classification thresholds', () => {
 const f = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 assert.equal(classify(mv({ before: 20, after: 20 }), undefined, f), 'best');
 assert.equal(classify(mv({ san: 'd4', before: 20, after: 10 }), undefined, f), 'excellent');
 assert.equal(classify(mv({ san: 'd4', before: 50, after: -250 }), undefined, f), 'blunder');
 assert.equal(classify(mv({ san: 'd4', before: 50, after: -20 }), undefined, f), 'inaccuracy');
});

test('great move punishes the previous mistake', () => {
 const f = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 const prev = mv({ ply: 1, color: 'b', san: 'a6', before: 0, after: 400 });
 assert.equal(classify(mv({ ply: 2, before: 400, after: 400 }), prev, f), 'great');
});

test('sacrifice detection', () => {
 // Knight jumps to a square covered by a pawn and undefended.
 assert.equal(isSacrifice('rnbqkbnr/pppp1ppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1', 'Nb5'), false);
 assert.equal(isSacrifice('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'exd5'), false);
 assert.equal(isSacrifice('4k3/8/2p5/8/8/8/8/4K1N1 w - - 0 1', 'Ne2'), false);
 assert.equal(isSacrifice('4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1', 'Nb5'), false);
 assert.equal(isSacrifice('4k3/8/2p5/8/8/2N5/8/4K3 w - - 0 1', 'Nb5'), true);
 assert.equal(isSacrifice('not a fen', 'e4'), false);
});

test('game accuracy and classifyGame', () => {
 const reviews = [mv({ ply: 1, before: 20, after: 20 }), mv({ ply: 2, color: 'b', san: 'e5', bestSan: 'e5', before: 20, after: 20 })];
 assert.ok(gameAccuracy(reviews, 'w')! > 99);
 assert.equal(gameAccuracy([], 'w'), null);
 const map = classifyGame('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e4', 'e5'], reviews);
 assert.equal(map.get(1), 'best');
 assert.equal(map.size, 2);
});

test('the engine top choice is never counted as an error', () => {
 assert.equal(winLoss(mv({ before: 20, after: -400 })), 0);
 assert.ok(winLoss(mv({ san: 'd4', before: 20, after: -400 })) > 20);
});
