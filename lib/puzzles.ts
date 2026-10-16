import { Chess } from 'chess.js';
// Puzzles come from the Lichess puzzle database (CC0); see public/data/puzzles.json.
export type Puzzle = { id: string; fen: string; moves: string; rating: number; themes: string };
export type PuzzleResult = { id: string; ok: boolean; rating: number; at: string };
export type PuzzleStats = { rating: number; solved: number; failed: number; streak: number; best: number; history: number[]; recent: PuzzleResult[]; daily?: { date: string; streak: number }; missed?: string[] };
export const defaultPuzzleStats: PuzzleStats = { rating: 1200, solved: 0, failed: 0, streak: 0, best: 0, history: [], recent: [] };

const expected = (user: number, puzzle: number) => 1 / (1 + 10 ** ((puzzle - user) / 400));

// Elo-style update; a larger K for the first 20 puzzles lets the rating settle quickly.
export function newRating(user: number, puzzle: number, ok: boolean, played: number) {
 const k = played < 20 ? 40 : 24;
 return Math.max(100, Math.round(user + k * ((ok ? 1 : 0) - expected(user, puzzle))));
}

// A random puzzle near the player's rating that was not seen recently; widens the window if needed.
export function pickPuzzle(all: Puzzle[], rating: number, recent: string[], rand: () => number = Math.random): Puzzle | null {
 const seen = new Set(recent);
 for (let spread = 100; spread <= 2500; spread += 150) {
  const pool = all.filter(p => !seen.has(p.id) && Math.abs(p.rating - rating) <= spread);
  if (pool.length >= 5 || (spread > 1000 && pool.length)) return pool[Math.floor(rand() * pool.length)];
 }
 return all.length ? all[Math.floor(rand() * all.length)] : null;
}

// The user's move is right if it is the stored solution move, or it checkmates (any mate is fine).
export function isSolutionMove(fenBefore: string, expectedUci: string, from: string, to: string, promotion?: string) {
 if (from + to + (expectedUci[4] ? (promotion || 'q') : '') === expectedUci) return true;
 try { const g = new Chess(fenBefore); g.move({ from, to, promotion: promotion || 'q' }); return g.isCheckmate(); } catch { return false; }
}

export function themeLabel(t: string) {
 const mate = t.match(/^mateIn(\d)$/); if (mate) return `Mate in ${mate[1]}`;
 return t.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
}

export function validStats(s: unknown): s is PuzzleStats {
 const x = s as PuzzleStats; const n = (v: unknown, max: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
 return !!x && n(x.rating, 4000) && n(x.solved, 1e6) && n(x.failed, 1e6) && n(x.streak, 1e6) && n(x.best, 4000)
  && (x.missed === undefined || (Array.isArray(x.missed) && x.missed.length <= 100 && x.missed.every(id => typeof id === 'string' && /^\w{1,16}$/.test(id))))
  && (x.daily === undefined || (typeof x.daily.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.daily.date) && n(x.daily.streak, 100000)))
  && Array.isArray(x.history) && x.history.length <= 100 && x.history.every(v => n(v, 4000))
  && Array.isArray(x.recent) && x.recent.length <= 50 && x.recent.every(r => r && typeof r.id === 'string' && /^\w{1,16}$/.test(r.id) && typeof r.ok === 'boolean' && n(r.rating, 4000) && typeof r.at === 'string' && r.at.length <= 40);
}

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The same puzzle for everyone on a given day, from the accessible 800-1800 range.
export function dailyPuzzle(all: Puzzle[], date: string): Puzzle | null {
 const pool = all.filter(p => p.rating >= 800 && p.rating <= 1800); const list = pool.length ? pool : all;
 if (!list.length) return null;
 let h = 5381; for (const ch of date) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
 return list[h % list.length];
}

// Streak after solving today's puzzle: continues from yesterday, restarts otherwise, unchanged if already done today.
export function nextDaily(prev: PuzzleStats['daily'], today: string): { date: string; streak: number } {
 if (prev?.date === today) return prev;
 const y = new Date(today + 'T12:00:00'); y.setDate(y.getDate() - 1);
 return { date: today, streak: prev?.date === todayKey(y) ? prev.streak + 1 : 1 };
}
