import { Chess, type Square } from 'chess.js';
import type { Evaluation, ReviewMove } from './chess';

export type Cls = 'book' | 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export const classes: Record<Cls, { label: string; symbol: string; color: string }> = {
 book: { label: 'Book', symbol: '≡', color: '#a88865' },
 brilliant: { label: 'Brilliant', symbol: '!!', color: '#1baca6' },
 great: { label: 'Great', symbol: '!', color: '#5c8bb0' },
 best: { label: 'Best', symbol: '★', color: '#81b64c' },
 excellent: { label: 'Excellent', symbol: '✓', color: '#96bc4b' },
 good: { label: 'Good', symbol: '✓', color: '#97af8b' },
 inaccuracy: { label: 'Inaccuracy', symbol: '?!', color: '#f7c631' },
 mistake: { label: 'Mistake', symbol: '?', color: '#e58f2a' },
 blunder: { label: 'Blunder', symbol: '??', color: '#ca3431' },
};
export const classOrder: Cls[] = ['book', 'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];

// Win probability for White (0-100) from a centipawn score: the logistic fit Lichess publishes.
export function winPercent(e: Evaluation): number {
 const cp = Math.max(-1000, Math.min(1000, e.cp));
 return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
const forMover = (w: number, color: string) => color === 'w' ? w : 100 - w;

// Win percentage the mover gave up with this move (0 when the move kept or improved it).
export function winLoss(r: ReviewMove): number {
 // The engine's own top choice cannot be an error; any drop is search-depth noise between two separate searches.
 if (r.san === r.bestSan) return 0;
 return Math.max(0, forMover(winPercent(r.before), r.color) - forMover(winPercent(r.after), r.color));
}

// Lichess's per-move accuracy curve over the win-percentage drop.
export function moveAccuracy(loss: number): number {
 return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
}

// Average of the arithmetic and harmonic means: the harmonic mean punishes a few bad moves
// the way chess.com and Lichess do. This is an estimate, not either site's exact figure.
export function gameAccuracy(reviews: ReviewMove[], color: 'w' | 'b'): number | null {
 const own = reviews.filter(r => r.color === color).map(r => moveAccuracy(winLoss(r)));
 if (!own.length) return null;
 const mean = own.reduce((a, b) => a + b, 0) / own.length;
 const harmonic = own.length / own.reduce((a, b) => a + 1 / Math.max(b, 1), 0);
 return (mean + harmonic) / 2;
}

const value: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// A sacrifice: the moved piece can be taken by something cheaper, or is attacked and
// undefended, without winning back its value on the move.
export function isSacrifice(fenBefore: string, san: string): boolean {
 try {
  const game = new Chess(fenBefore);
  const mover = game.turn();
  const m = game.move(san);
  const worth = value[m.piece];
  if (worth < 3) return false;
  const gained = m.captured ? value[m.captured] : 0;
  if (worth - gained < 2) return false;
  const attackers = game.attackers(m.to as Square, mover === 'w' ? 'b' : 'w');
  if (!attackers.length) return false;
  const cheapest = Math.min(...attackers.map(s => value[game.get(s)!.type] || 99));
  const defended = game.attackers(m.to as Square, mover).length > 0;
  return cheapest < worth || !defended;
 } catch { return false; }
}

export function classify(r: ReviewMove, previous: ReviewMove | undefined, fenBefore: string): Cls {
 const loss = winLoss(r);
 if (loss >= 20) return 'blunder';
 if (loss >= 10) return 'mistake';
 if (loss >= 5) return 'inaccuracy';
 const best = r.san === r.bestSan;
 const moverBefore = forMover(winPercent(r.before), r.color);
 const moverAfter = forMover(winPercent(r.after), r.color);
 if (loss < 2 && (moverBefore < 90 || r.before.mate !== undefined) && moverAfter >= 40 && isSacrifice(fenBefore, r.san)) return 'brilliant';
 if (best && previous && previous.color !== r.color && winLoss(previous) >= 10) return 'great';
 if (best) return 'best';
 return loss < 2 ? 'excellent' : 'good';
}

// Classification for every reviewed ply, keyed by ply number.
export function classifyGame(startFen: string, sans: string[], reviews: ReviewMove[], book?: (fen: string) => boolean): Map<number, Cls> {
 const byPly = new Map(reviews.map(r => [r.ply, r]));
 const out = new Map<number, Cls>();
 const game = new Chess(startFen);
 sans.forEach((san, i) => {
  const r = byPly.get(i + 1);
  const before = game.fen();
  try { game.move(san); } catch { /* stop on malformed PGN */ }
  if (r) out.set(r.ply, book?.(game.fen()) && winLoss(r) < 5 ? 'book' : classify(r, byPly.get(i), before));
 });
 return out;
}

export function classCounts(map: Map<number, Cls>, reviews: ReviewMove[], color: 'w' | 'b'): Record<Cls, number> {
 const counts = Object.fromEntries(classOrder.map(c => [c, 0])) as Record<Cls, number>;
 for (const r of reviews) if (r.color === color) { const c = map.get(r.ply); if (c) counts[c]++; }
 return counts;
}
