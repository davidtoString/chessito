import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { classicTexts, eras, playerTags } from '../lib/classics.ts';

type G = { id: string; source?: string; link?: string; white: string; black: string; event: string; date: string; result: string; depth: number; sans: string[]; cp: number[]; mate: (number | null)[]; best: string[] };
const games: G[] = JSON.parse(readFileSync('public/data/classics.json', 'utf8'));

test('every game replays legally and its evaluations line up', () => {
 assert.ok(games.length >= 20);
 assert.equal(new Set(games.map(g => g.id)).size, games.length);
 for (const g of games) {
  const c = new Chess(); for (const s of g.sans) c.move(s);     // throws on an illegal move
  const n = g.sans.length;
  assert.ok(n >= 17, g.id);
  assert.equal(g.cp.length, n + 1, g.id); assert.equal(g.mate.length, n + 1, g.id); assert.equal(g.best.length, n + 1, g.id);
  assert.ok(['1-0', '0-1', '1/2-1/2'].includes(g.result), g.id);
  assert.ok(g.white && g.black && g.event && g.date, g.id);
  if (g.sans.at(-1)!.endsWith('#')) { assert.ok(c.isCheckmate(), g.id); assert.equal(g.result, c.turn() === 'b' ? '1-0' : '0-1', g.id + ' result matches the mate'); }
  const startBest = g.best[0]; assert.ok(/^[a-h][1-8][a-h][1-8]/.test(startBest), g.id);
 }
});

test('every game has commentary and every moment is the move actually played', () => {
 for (const g of games) assert.ok(classicTexts[g.id], `${g.id} needs text`);
 for (const id of Object.keys(classicTexts)) assert.ok(games.some(g => g.id === id), `${id} has no game`);
 for (const g of games) {
  const t = classicTexts[g.id];
  assert.ok(eras.some(e => e.id === t.era), g.id);
  for (const tag of t.players ?? []) assert.ok(playerTags.some(p => p.id === tag), `${g.id}: unknown player tag ${tag}`);
  if (g.source === 'chesscom') { assert.match(g.link ?? '', /^https:\/\/www\.chess\.com\/game\/live\/\d+$/, g.id); assert.equal(t.era, 'online', g.id + ' online games sit in the online era'); }
  assert.ok(t.title && t.tagline && t.story.length > 80 && t.takeaway.length > 20, g.id);
  assert.ok(t.moments.length >= 2, g.id);
  for (const mo of t.moments) {
   const ply = (mo.move - 1) * 2 + (mo.side === 'w' ? 1 : 2);
   assert.equal(g.sans[ply - 1], mo.san, `${g.id}: move ${mo.move}${mo.side === 'w' ? '.' : '...'} should be ${mo.san}, the game has ${g.sans[ply - 1]}`);
   assert.ok(mo.note.length > 10, g.id);
  }
 }
});

test('famous facts hold in the data', () => {
 const byId = Object.fromEntries(games.map(g => [g.id, g]));
 assert.equal(byId['carlsen-nepo-g6'].sans.length, 271, '136 moves, the longest world championship game');
 assert.equal(byId['deep-blue-g6'].sans.length, 37, 'Kasparov resigned after 19 moves');
 assert.match(byId['byrne-fischer'].sans.at(-1)!, /#$/);
 assert.equal(byId['immortal'].sans.at(-1), 'Be7#');
 assert.equal(byId['opera'].sans.at(-1), 'Rd8#');
 assert.equal(byId['ding-gukesh-g14'].result, '0-1');
 assert.equal(byId['fischer-spassky-g6'].sans[0], 'c4');
 assert.ok(byId['karpov-kasparov-g24'].date.startsWith('1985') && byId['karpov-kasparov-g24'].result === '0-1');
});

test('every player tag has at least one game, and the new collections are present', () => {
 const count = (tag: string) => games.filter(g => classicTexts[g.id]?.players?.includes(tag as never)).length;
 assert.ok(count('carlsen') >= 7, 'Carlsen games');
 assert.ok(count('nakamura') >= 3, 'Nakamura games');
 assert.ok(count('gotham') >= 2, 'GothamChess games');
 assert.ok(count('botez') >= 2, 'Alexandra Botez games');
 const byId = Object.fromEntries(games.map(g => [g.id, g]));
 assert.equal(byId['carlsen-anand-g5'].result, '1-0'); assert.equal(byId['carlsen-anand-g5'].sans.length, 115);
 assert.equal(byId['carlsen-karjakin-tb4'].result, '1-0'); assert.ok(byId['carlsen-karjakin-tb4'].date.startsWith('2016.11.30'));
 assert.equal(byId['carlsen-caruana-tb3'].result, '1-0');
 assert.equal(byId['carlsen-ernst'].result, '1-0'); assert.ok(byId['carlsen-ernst'].date.startsWith('2004'));
 assert.equal(byId['nakamura-gukesh-candidates'].result, '1/2-1/2'); assert.equal(byId['nakamura-gukesh-candidates'].sans.length, 141);
});
