import { Chess } from 'chess.js';
// The practice bots: a ladder from about 400 to 3000 plus a few with a distinct style or opening.
// Stored games keep only the bot's index, so existing indexes (0-3) never change and new bots are appended.
export type Style = 'balanced' | 'aggressive' | 'solid' | 'slippy';
export type Mode = 'legacy' | 'elo' | 'full' | 'style';
export type Odds = 'pawn' | 'knight' | 'rook' | 'queen';
export type Bot = {
 index: number; name: string; level: string; group: 'ladder' | 'style' | 'odds' | 'custom'; elo: number; description: string; mode: Mode;
 skill: number; chance: number;      // legacy/custom-low: Stockfish skill level and the chance of a random move
 style?: Style; book?: string;      // personality: how it chooses among the engine's best lines, and an opening repertoire
 blitz?: boolean;                   // plays fast, and plays worse as its own clock runs down
 odds?: Odds;       // handicap: the bot starts without this piece
 //      // personality: how it chooses among the engine's best lines, and an opening repertoire
};
export const CUSTOM_BASE = 1000;     // a custom bot is stored as 1000 + its Elo
export const MIN_ELO = 400, MAX_ELO = 3000;
const L = (index: number, name: string, level: string, elo: number, description: string, mode: Mode, skill = 20, chance = 0): Bot => ({ index, name, level, group: 'ladder', elo, description, mode, skill, chance });
const S = (index: number, name: string, level: string, elo: number, description: string, style: Style, book?: string): Bot => ({ index, name, level, group: 'style', elo, description, mode: 'style', skill: 20, chance: 0, style, book });

const T = (index: number, name: string, level: string, elo: number, description: string): Bot => ({ index, name, level, group: 'style', elo, description, mode: 'elo', skill: 20, chance: 0, blitz: true });
const O = (index: number, name: string, odds: Odds, elo: number, description: string): Bot => ({ index, name, level: `Odds: ${odds}`, group: 'odds', elo, description, mode: elo >= 2900 ? 'full' : 'elo', skill: 20, chance: 0, odds });

export const bots: Bot[] = [
 L(0, 'Pip', 'First steps', 400, 'A patient sparring partner. Plenty of room to learn.', 'legacy', 0, .65),
 L(1, 'Clover', 'Beginner', 700, 'Find your footing and look for loose pieces.', 'legacy', 3, .35),
 L(2, 'Scout', 'Developing', 1100, 'A little more tactical. Think one move ahead.', 'legacy', 8, .12),
 L(3, 'Atlas', 'Challenging', 2000, 'A strong opponent for a proper stretch.', 'legacy', 18, 0),
 L(4, 'Maple', 'Beginner+', 900, 'Keeps most pieces safe, but misses two-move tricks.', 'legacy', 5, .22),
 L(5, 'Juniper', 'Improving', 1300, 'Plays sensible chess and punishes simple mistakes.', 'legacy', 10, .06),
 L(6, 'Ember', 'Club player', 1400, 'A steady club player. Few free gifts.', 'elo'),
 L(7, 'Harbor', 'Strong club', 1600, 'Solid and patient. Tactics need to be sound.', 'elo'),
 L(8, 'Quill', 'Advanced', 1800, 'Calculates well and rarely hangs anything.', 'elo'),
 L(9, 'Nova', 'Expert', 2200, 'Expert strength: you need a plan, not just tricks.', 'elo'),
 L(10, 'Titan', 'Master', 2500, 'Master strength. Mistakes are punished at once.', 'elo'),
 L(11, 'Maximus', 'Full strength', 3000, 'Stockfish at full strength for its short thinking time.', 'full'),
 S(12, 'Gambit Gwen', 'Attacker', 1500, 'Loves checks, captures and sacrifices. Defend carefully.', 'aggressive'),
 S(13, 'Walter the Wall', 'Defender', 1500, 'Develops, castles, trades when ahead and waits for your mistake.', 'solid'),
 S(14, 'Sicilian Sam', 'Opening: Sicilian', 1600, 'Plays 1.e4 and the Sicilian. Learn the opening by playing it.', 'balanced', 'sicilian'),
 S(15, 'London Lou', 'Opening: London', 1500, 'Plays the London System with White and a solid d5 setup with Black.', 'balanced', 'london'),
 S(16, 'Oops Ollie', 'Blunder-prone', 1700, 'Plays well, then every so often drops the ball. Be ready to pounce.', 'slippy'),
 T(17, 'Tick', 'Time-pressure', 1800, 'Moves in a flash, and plays worse as its own clock runs low. Try to outlast it.'),
 O(18, 'Pawnless Pete', 'pawn', 2000, 'Strong, but starts without its f-pawn. A gentle handicap.'),
 O(19, 'Knightless Kai', 'knight', 2300, 'Very strong, but starts without its queenside knight.'),
 O(20, 'Rookless Rae', 'rook', 2600, 'Master strength, but starts without its queenside rook.'),
 O(21, 'Queenless Quinn', 'queen', 3000, 'Full strength, but starts without its queen. A real test.'),
];
export const ladder = bots.filter(b => b.group === 'ladder').sort((a, b) => a.elo - b.elo);
export const styleBots = bots.filter(b => b.group === 'style');
export const oddsBots = bots.filter(b => b.group === 'odds');

// The starting position for a handicap bot: the bot's side loses one piece (a pawn, the b-knight, the a-rook or the queen).
export function oddsFen(odds: Odds, botColor: 'w' | 'b'): string {
 const g = new Chess(); const rank = botColor === 'w' ? '1' : '8', pawn = botColor === 'w' ? '2' : '7';
 g.remove((odds === 'queen' ? 'd' + rank : odds === 'rook' ? 'a' + rank : odds === 'knight' ? 'b' + rank : 'f' + pawn) as 'a1');
 const [board, turn, castling, ep, half, full] = g.fen().split(' ');
 const rights = odds === 'rook' ? castling.replace(botColor === 'w' ? 'Q' : 'q', '') : castling;
 return [board, turn, rights || '-', ep, half, full].join(' ');
}

export const isCustom = (index: number) => index >= CUSTOM_BASE;
export const clampElo = (elo: number) => Math.min(MAX_ELO, Math.max(MIN_ELO, Math.round(elo / 50) * 50));
export function customBot(elo: number): Bot {
 const e = clampElo(elo);
 // Below the engine's own 1320 floor, blend a weaker search with random moves (the same idea as Pip and Clover).
 if (e < 1320) return { index: CUSTOM_BASE + e, name: `Custom ${e}`, level: 'Custom', group: 'custom', elo: e, description: 'Your own difficulty.', mode: 'legacy', skill: Math.round((e - MIN_ELO) / 920 * 8), chance: Math.max(0, +(0.65 * (1320 - e) / 920).toFixed(2)) };
 return { index: CUSTOM_BASE + e, name: `Custom ${e}`, level: 'Custom', group: 'custom', elo: e, description: 'Your own difficulty.', mode: e >= 2900 ? 'full' : 'elo', skill: 20, chance: 0 };
}
export function getBot(index: number): Bot { return isCustom(index) ? customBot(index - CUSTOM_BASE) : bots[index] ?? bots[0]; }
// The native engines (Maia, Lc0 and so on) only know four levels, so every bot maps to the nearest one.
export function legacyLevel(index: number): number { if (index >= 0 && index < 4) return index; const e = getBot(index).elo; return e < 800 ? 0 : e < 1300 ? 1 : e < 1800 ? 2 : 3; }
export const validBotIndex = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && ((n as number) < bots.length || ((n as number) >= CUSTOM_BASE + MIN_ELO && (n as number) <= CUSTOM_BASE + MAX_ELO));
