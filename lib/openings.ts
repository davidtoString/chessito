// Opening names from lichess-org/chess-openings (CC0), keyed by the first four FEN fields.
export type Openings = Record<string, [string, string]>;
let cached: Promise<Openings> | null = null;

export function loadOpenings(): Promise<Openings> {
 cached ||= fetch('/data/openings.json').then(r => { if (!r.ok) throw new Error('Opening names are unavailable.'); return r.json() as Promise<Openings>; }).catch(e => { cached = null; throw e; });
 return cached;
}
const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
export const openingAt = (db: Openings | null, fen: string) => db?.[key(fen)] ?? null;
export const isBook = (db: Openings | null) => (fen: string) => !!db && key(fen) in db;

// The most recent named opening reached at or before `ply`, given the FEN after each ply.
export function openingFor(db: Openings | null, fens: string[], ply: number) {
 for (let i = Math.min(ply, fens.length - 1); i >= 0; i--) { const o = openingAt(db, fens[i]); if (o) return o; }
 return null;
}
