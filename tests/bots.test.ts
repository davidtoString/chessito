import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { bots, ladder, styleBots, getBot, customBot, legacyLevel, validBotIndex, clampElo, CUSTOM_BASE } from '../lib/bots.ts';
import { books, bookMove } from '../lib/bot-books.ts';
import { chooseStyled, botMove, type Thinker } from '../lib/bot-move.ts';
import type { EngineLine } from '../lib/engine.ts';

const line = (uci: string, cp: number, mate?: number): EngineLine => ({ multipv: 1, depth: 8, cp, mate, pv: [uci] });
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

test('bot indexes are stable: the first four keep their old settings and every index is unique', () => {
 assert.deepEqual(bots.map(b => b.index), bots.map((_, i) => i));
 assert.deepEqual(bots.slice(0, 4).map(b => [b.name, b.skill, b.chance]), [['Pip', 0, .65], ['Clover', 3, .35], ['Scout', 8, .12], ['Atlas', 18, 0]]);
 assert.equal(new Set(bots.map(b => b.name)).size, bots.length);
 assert.ok(bots.length >= 16);
});

test('the ladder climbs from about 400 to 3000 with no big jumps', () => {
 const elos = ladder.map(b => b.elo);
 assert.equal(elos[0], 400); assert.equal(elos.at(-1), 3000);
 for (let i = 1; i < elos.length; i++) assert.ok(elos[i] - elos[i - 1] <= 500, `gap before ${ladder[i].name}`);
 assert.ok(ladder.length >= 12);
 for (const b of styleBots) assert.ok(b.style || b.blitz, b.name);
});

test('custom bots round-trip through the stored index and map to a native engine level', () => {
 assert.equal(clampElo(10), 400); assert.equal(clampElo(9000), 3000); assert.equal(clampElo(1523), 1500);
 const c = customBot(1650); assert.equal(c.index, CUSTOM_BASE + 1650); assert.equal(getBot(c.index).elo, 1650); assert.equal(c.mode, 'elo');
 const low = getBot(CUSTOM_BASE + 400); assert.equal(low.mode, 'legacy'); assert.ok(low.chance > .5);
 const mid = getBot(CUSTOM_BASE + 1300); assert.ok(mid.chance < low.chance && mid.skill > low.skill);
 assert.equal(getBot(CUSTOM_BASE + 3000).mode, 'full');
 assert.ok(validBotIndex(0) && validBotIndex(16) && validBotIndex(CUSTOM_BASE + 1500));
 assert.ok(!validBotIndex(-1) && !validBotIndex(bots.length) && !validBotIndex(CUSTOM_BASE + 100) && !validBotIndex(1.5) && !validBotIndex('3'));
 assert.deepEqual([0, 1, 2, 3].map(legacyLevel), [0, 1, 2, 3]);
 assert.ok(bots.every(b => [0, 1, 2, 3].includes(legacyLevel(b.index))));
});

test('every opening line is legal and each book answers both colours', () => {
 for (const [name, lines] of Object.entries(books)) {
  for (const l of lines) { const g = new Chess(); for (const s of l) assert.doesNotThrow(() => g.move(s), `${name}: ${l.join(' ')} fails at ${s}`); }
  assert.ok(lines.some(l => l[0] === 'e4') || lines.some(l => l[0] === 'd4'), name);
  assert.ok(bookMove(name, [], () => 0) !== null, `${name} as White`);
  assert.ok(bookMove(name, ['e4'], () => 0) !== null, `${name} as Black against 1.e4`);
 }
 assert.equal(bookMove('sicilian', [], () => 0), 'e4');
 assert.equal(bookMove('sicilian', ['e4'], () => 0), 'c5');
 assert.equal(bookMove('london', ['d4'], () => 0), 'd5');
 assert.equal(bookMove('london', ['d4', 'd5'], () => 0), 'Bf4');
 assert.equal(bookMove('sicilian', ['a4'], () => 0), null, 'out of book');
 assert.equal(bookMove(undefined, [], () => 0), null);
 const ids = (b: string) => new Set((books[b] ?? []).map(l => l.join(' ')));
 assert.equal(ids('sicilian').size, books.sicilian.length, 'no duplicate lines');
});

test('chooseStyled: forced mates, and the balanced style, always play the best line', () => {
 const fen = new Chess().fen();
 assert.equal(chooseStyled(fen, [line('e2e4', 30), line('d2d4', 20)], 'balanced', 0), 'e2e4');
 assert.equal(chooseStyled(fen, [line('a2a3', 0), line('e2e4', 12000, 3)], 'aggressive', 0, () => 0), 'e2e4', 'mate beats style');
 const black = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';
 assert.equal(chooseStyled(black, [line('e7e5', 40), line('d7d5', -10)], 'balanced', 1), 'd7d5', 'scores are from White’s side, so Black prefers the lower one');
});

test('Oops Ollie slips only some of the time, and never when there is one legal choice', () => {
 const fen = new Chess().fen(); const lines = [line('e2e4', 30), line('g2g4', -150), line('f2f3', -90)];
 assert.equal(chooseStyled(fen, lines, 'slippy', 0, seq(0.9)), 'e2e4');
 assert.ok(['g2g4', 'f2f3'].includes(chooseStyled(fen, lines, 'slippy', 0, seq(0.01, 0.2))));
 let slips = 0; for (let i = 0; i < 2000; i++) if (chooseStyled(fen, lines, 'slippy', 0, Math.random) !== 'e2e4') slips++;
 assert.ok(slips > 150 && slips < 450, `slip rate ${slips / 2000}`);
 assert.equal(chooseStyled(fen, [line('e2e4', 30)], 'slippy', 0, () => 0), 'e2e4');
});

test('Gambit Gwen prefers a check or capture inside her window, but not a clearly worse move', () => {
 // White to move: Bxf7+ (check, capture) is slightly worse than the quiet best move.
 const fen = 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 3';
 assert.equal(chooseStyled(fen, [line('d2d3', 40), line('c4f7', 0)], 'aggressive', 4, () => 0), 'c4f7');
 assert.equal(chooseStyled(fen, [line('d2d3', 40), line('c4f7', -300)], 'aggressive', 4, () => 0), 'd2d3', 'outside the window');
});

test('Walter the Wall castles and develops rather than pushing the queen out', () => {
 const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5';
 assert.equal(chooseStyled(fen, [line('d1e2', 25), line('e1g1', 15)], 'solid', 8, () => 0), 'e1g1');
 const early = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 assert.equal(chooseStyled(early, [line('d2d4', 20), line('b1c3', 15)], 'solid', 0, () => 0), 'b1c3', 'a developing move earns a small bonus');
});

test('botMove follows the book, then asks the engine at the right strength', async () => {
 const calls: unknown[] = [];
 const engine: Thinker = { think: async (fen, o) => { calls.push(o); return { best: 'e2e4', lines: [line('e2e4', 30), line('d2d4', 20)] }; } };
 const start = new Chess().fen();
 assert.equal(await botMove(engine, start, [], getBot(14), () => 0), 'e2e4'); assert.equal(calls.length, 0, 'book move needs no engine');
 const after = new Chess(); after.move('a4');
 await botMove(engine, after.fen(), ['a4'], getBot(14), () => 0.5); assert.equal(calls.length, 1, 'out of book: engine');
 calls.length = 0;
 await botMove(engine, start, [], getBot(7), () => 0.5); assert.deepEqual(calls[0], { elo: 1600, ms: 900 });
 await botMove(engine, start, [], getBot(11), () => 0.5); assert.equal((calls[1] as { skill: number }).skill, 20);
 await botMove(engine, start, [], getBot(12), () => 0.5); assert.equal((calls[2] as { multipv: number }).multipv, 4);
 const random = await botMove(engine, start, [], getBot(0), () => 0.1); assert.equal(calls.length, 3, 'Pip’s random move needs no engine');
 assert.ok(new Chess().moves({ verbose: true }).some(m => m.from + m.to === random.slice(0, 4)));
 const mated = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'); assert.equal(mated.isCheckmate() || mated.isStalemate(), true);
 assert.equal(await botMove(engine, mated.fen(), [], getBot(7), () => 0.5), '', 'no legal moves');
});

test('handicap bots start a piece down, and Tick plays worse as its clock runs low', async () => {
 const { oddsFen, oddsBots } = await import('../lib/bots.ts');
 const { blitzSettings } = await import('../lib/bot-move.ts');
 assert.equal(oddsBots.length, 4);
 const count = (fen: string, ch: string) => fen.split(' ')[0].split('').filter(c => c === ch).length;
 const botFen = (o: 'pawn' | 'knight' | 'rook' | 'queen', c: 'w' | 'b') => oddsFen(o, c);
 const q = botFen('queen', 'b'); assert.equal(count(q, 'q'), 0); assert.equal(count(q, 'Q'), 1); assert.equal(count(q, 'p'), 8);
 const n = botFen('knight', 'w'); assert.equal(count(n, 'N'), 1); assert.equal(count(n, 'n'), 2);
 const r = botFen('rook', 'b'); assert.equal(count(r, 'r'), 1); assert.ok(!r.split(' ')[2].includes('q') && r.split(' ')[2].includes('k') && r.split(' ')[2].includes('KQ'), 'no queenside castling for the side without that rook');
 const p = botFen('pawn', 'w'); assert.equal(count(p, 'P'), 7); assert.equal(count(p, 'p'), 8);
 for (const o of ['pawn', 'knight', 'rook', 'queen'] as const) for (const c of ['w', 'b'] as const) { const f = oddsFen(o, c); assert.doesNotThrow(() => new Chess(f), `${o}/${c}`); assert.equal(f.split(' ')[1], 'w', 'white still moves first'); assert.ok(new Chess(f).moves().length > 0); }
 assert.deepEqual(blitzSettings(1800, null), { elo: 1800, ms: 250 });
 assert.equal(blitzSettings(1800, 120000).elo, 1800);
 assert.ok(blitzSettings(1800, 30000).elo < 1800 && blitzSettings(1800, 8000).elo < blitzSettings(1800, 30000).elo);
 assert.equal(blitzSettings(1500, 2000).elo, 1320, 'never below the engine’s floor');
 assert.ok(blitzSettings(1800, 1000).ms >= 60 && blitzSettings(1800, 300000).ms <= 900);
});
