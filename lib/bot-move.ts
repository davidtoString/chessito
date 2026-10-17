import { Chess } from 'chess.js';
import { bookMove } from './bot-books.ts';
import type { Bot, Style } from './bots.ts';
import type { EngineLine } from './engine';

export type Thinker = { think(fen: string, o: { elo?: number; skill?: number; multipv?: number; depth?: number; ms?: number }): Promise<{ best: string; lines: EngineLine[] }> };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const uciOf = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion || '');

// How far below the best line each style will go, and how it rates the candidates inside that window (centipawns).
const WINDOW: Record<Style, number> = { balanced: 0, aggressive: 90, solid: 50, slippy: 0 };

function bonus(fen: string, uci: string, style: Style, bestForMover: number, plyCount: number): number {
 const g = new Chess(fen); let m;
 try { m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { return -999; }
 const checks = m.san.includes('+') || m.san.includes('#');
 if (style === 'aggressive') {
  let b = 0;
  if (m.captured) b += 30; if (checks) b += 40; if (m.promotion) b += 20;
  // A sacrifice: the piece lands where it can be captured by something worth less than it.
  if (VALUE[m.piece] >= 3) { const replies = g.moves({ verbose: true }).filter(r => r.to === m.to); if (replies.some(r => VALUE[r.piece] < VALUE[m.piece])) b += 25; }
  return b;
 }
 if (style === 'solid') {
  let b = 0;
  if (m.flags.includes('k') || m.flags.includes('q')) b += 40;
  if (plyCount < 24 && (m.piece === 'n' || m.piece === 'b') && /1$/.test(m.from) === (m.color === 'w') && /[18]$/.test(m.from)) b += 20;   // developing a piece from the back rank
  if (plyCount < 24 && m.piece === 'q') b -= 25;
  if (m.piece === 'k' && !m.flags.includes('k') && !m.flags.includes('q')) b -= 30;
  if (bestForMover > 150 && m.captured && VALUE[m.captured] >= VALUE[m.piece]) b += 25;   // ahead: trade down
  return b;
 }
 return 0;
}

// Picks one move from the engine's best lines. Pure given the lines and rng, so it can be tested without an engine.
export function chooseStyled(fen: string, lines: EngineLine[], style: Style, plyCount: number, rng: () => number = Math.random): string {
 if (!lines.length) return '';
 const white = new Chess(fen).turn() === 'w';
 const scored = lines.map(l => ({ uci: l.pv[0], s: (l.mate !== undefined ? (l.mate > 0 ? 10000 : -10000) : l.cp) * (white ? 1 : -1) }));
 const best = Math.max(...scored.map(x => x.s));
 if (best >= 9000 || scored.length === 1) return scored.find(x => x.s === best)!.uci;      // a forced mate is always played
 if (style === 'slippy') {
  // Usually the best move; now and then one of the other good-looking candidates, even if it loses something.
  if (rng() < 0.14) { const others = scored.filter(x => x.s < best); if (others.length) return others[Math.floor(rng() * others.length)].uci; }
  return scored.find(x => x.s === best)!.uci;
 }
 const win = WINDOW[style];
 const pool = scored.filter(x => x.s >= best - win);
 let top = pool[0], topScore = -Infinity;
 for (const x of pool) { const v = x.s + bonus(fen, x.uci, style, best, plyCount) + rng() * 10; if (v > topScore) { topScore = v; top = x; } }
 return top.uci;
}

// The move a bot plays: its opening book first, then the engine at the bot's strength.
// `history` is the SAN of every move played so far (the FEN alone does not carry it).
export async function botMove(engine: Thinker, fen: string, history: string[], bot: Bot, rng: () => number = Math.random): Promise<string> {
 const g = new Chess(fen);
 const legal = g.moves({ verbose: true }); if (!legal.length) return '';
 const san = bookMove(bot.book, history, rng);
 if (san) { const m = legal.find(x => x.san === san); if (m) return uciOf(m); }
 if (bot.mode === 'legacy' && rng() < bot.chance) return uciOf(legal[Math.floor(rng() * legal.length)]);
 if (bot.mode === 'legacy') return (await engine.think(fen, { skill: bot.skill, depth: 10, ms: 1200 })).best;
 if (bot.mode === 'full') return (await engine.think(fen, { skill: 20, depth: 14, ms: 1500 })).best;
 if (bot.mode === 'elo') return (await engine.think(fen, { elo: bot.elo, ms: 900 })).best;
 const r = await engine.think(fen, { skill: 20, multipv: 4, depth: bot.style === 'slippy' ? 10 : 6, ms: 900 });
 return chooseStyled(fen, r.lines, bot.style ?? 'balanced', history.length, rng) || r.best;
}
