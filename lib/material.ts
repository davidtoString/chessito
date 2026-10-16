import { Chess } from 'chess.js';
const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const value: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const order = ['q', 'r', 'b', 'n', 'p'];

// Pieces each side has lost, derived from the position (promotions make this approximate,
// same as chess.com), and the material lead for White (negative = Black ahead).
export function material(fen: string) {
 const board = new Chess(fen).board().flat();
 const count = { w: {} as Record<string, number>, b: {} as Record<string, number> };
 for (const p of board) if (p && p.type !== 'k') count[p.color][p.type] = (count[p.color][p.type] || 0) + 1;
 const lost = (c: 'w' | 'b') => order.flatMap(t => Array<string>(Math.max(0, start[t] - (count[c][t] || 0))).fill(t));
 const score = (c: 'w' | 'b') => order.reduce((s, t) => s + (count[c][t] || 0) * value[t], 0);
 // capturedBy.w = black pieces White has taken
 return { capturedBy: { w: lost('b'), b: lost('w') }, diff: score('w') - score('b') };
}
