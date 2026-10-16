import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyPuzzle, nextDaily, todayKey, newRating, pickPuzzle, isSolutionMove, themeLabel, validStats, defaultPuzzleStats, type Puzzle } from '../lib/puzzles.ts';

test('rating moves toward the result and settles after 20 puzzles', () => {
 assert.ok(newRating(1200, 1200, true, 0) > 1200);
 assert.ok(newRating(1200, 1200, false, 0) < 1200);
 assert.equal(newRating(1200, 1200, true, 0), 1220);
 assert.equal(newRating(1200, 1200, true, 30), 1212);
 assert.ok(newRating(1200, 1800, true, 30) - 1200 > newRating(1200, 1000, true, 30) - 1200);
 assert.ok(newRating(120, 100, false, 30) >= 100);
});

test('pickPuzzle stays near the rating and skips recent puzzles', () => {
 const all: Puzzle[] = Array.from({ length: 40 }, (_, i) => ({ id: 'p' + i, fen: 'x', moves: 'a', rating: 800 + i * 50, themes: '' }));
 for (let i = 0; i < 20; i++) { const p = pickPuzzle(all, 1500, ['p14']); assert.ok(p && p.id !== 'p14' && Math.abs(p.rating - 1500) <= 400); }
 assert.equal(pickPuzzle([], 1500, []), null);
 assert.ok(pickPuzzle(all, 5000, [])); // far outside the range still returns something
});

test('solution check accepts the stored move or any mate', () => {
 const fen = 'k7/8/1K6/8/8/8/8/7R w - - 0 1'; // Rh8# is mate; Rh7 is not
 assert.equal(isSolutionMove(fen, 'h1h8', 'h1', 'h8'), true);
 assert.equal(isSolutionMove(fen, 'b6a6', 'h1', 'h8'), true); // different move, but mates
 assert.equal(isSolutionMove(fen, 'h1h8', 'h1', 'h7'), false);
 assert.equal(isSolutionMove(fen, 'h1h8', 'a8', 'a7'), false);
});

test('theme labels and stats validation', () => {
 assert.equal(themeLabel('mateIn2'), 'Mate in 2');
 assert.equal(themeLabel('hangingPiece'), 'Hanging Piece');
 assert.equal(validStats(defaultPuzzleStats), true);
 assert.equal(validStats({ ...defaultPuzzleStats, rating: -5 }), false);
 assert.equal(validStats({ ...defaultPuzzleStats, recent: [{ id: '../x', ok: true, rating: 1, at: 'now' }] }), false);
 assert.equal(validStats(null), false);
});

test('daily puzzle is stable per date and streaks continue only day to day', () => {
 const all: Puzzle[] = Array.from({ length: 200 }, (_, i) => ({ id: 'p' + i, fen: 'x', moves: 'a', rating: 600 + i * 10, themes: '' }));
 assert.equal(dailyPuzzle(all, '2026-10-16')!.id, dailyPuzzle(all, '2026-10-16')!.id);
 assert.ok(dailyPuzzle(all, '2026-10-16')!.rating >= 800 && dailyPuzzle(all, '2026-10-16')!.rating <= 1800);
 assert.notEqual(new Set(Array.from({ length: 30 }, (_, i) => dailyPuzzle(all, `2026-11-${String(i + 1).padStart(2, '0')}`)!.id)).size, 1);
 assert.equal(dailyPuzzle([], '2026-10-16'), null);
 assert.deepEqual(nextDaily(undefined, '2026-10-16'), { date: '2026-10-16', streak: 1 });
 assert.deepEqual(nextDaily({ date: '2026-10-15', streak: 4 }, '2026-10-16'), { date: '2026-10-16', streak: 5 });
 assert.deepEqual(nextDaily({ date: '2026-10-13', streak: 4 }, '2026-10-16'), { date: '2026-10-16', streak: 1 });
 assert.deepEqual(nextDaily({ date: '2026-10-16', streak: 4 }, '2026-10-16'), { date: '2026-10-16', streak: 4 });
 assert.deepEqual(nextDaily({ date: '2026-02-28', streak: 2 }, '2026-03-01'), { date: '2026-03-01', streak: 3 });
 assert.match(todayKey(new Date(2026, 0, 5)), /^2026-01-05$/);
 assert.equal(validStats({ ...defaultPuzzleStats, daily: { date: '2026-10-16', streak: 2 } }), true);
 assert.equal(validStats({ ...defaultPuzzleStats, daily: { date: 'x', streak: 2 } }), false);
});

test('missed puzzle ids are validated', () => {
 assert.equal(validStats({ ...defaultPuzzleStats, missed: ['abc12', 'Pq6K9'] }), true);
 assert.equal(validStats({ ...defaultPuzzleStats, missed: ['../x'] }), false);
 assert.equal(validStats({ ...defaultPuzzleStats, missed: Array.from({ length: 101 }, (_, i) => 'p' + i) }), false);
});
