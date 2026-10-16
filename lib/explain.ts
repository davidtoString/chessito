import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

// Plain-language explanations built from the position itself plus an engine line.
// Nothing here calls an LLM: facts come from chess.js, evaluations from Stockfish.
const V: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const pieceName = (t: string) => NAME[t];

export type Pc = { sq: Square; type: PieceSymbol; color: Color };
export type PvLine = { pv: string[]; cp: number; mate?: number };   // pv[0] is the move itself; scores are from White's side
const other = (c: Color): Color => c === 'w' ? 'b' : 'w';
const sqName = (f: number, r: number) => `${'abcdefgh'[f]}${r + 1}` as Square;
const label = (p: Pc) => `${pieceName(p.type)} on ${p.sq}`;

function piecesOf(g: Chess, color: Color): Pc[] {
 const out: Pc[] = [];
 g.board().forEach((row, i) => row.forEach((p, j) => { if (p && p.color === color) out.push({ sq: sqName(j, 7 - i), type: p.type, color }); }));
 return out;
}
const cheapest = (g: Chess, sq: Square, by: Color) => { const a = g.attackers(sq, by); return a.length ? Math.min(...a.map(s => V[g.get(s)!.type])) : 0; };

// A piece is "en prise" when it can be captured at a profit.
function enPrise(g: Chess, p: Pc): boolean {
 if (p.type === 'k') return false;
 const attack = cheapest(g, p.sq, other(p.color)); if (!attack) return false;
 const defended = g.attackers(p.sq, p.color).length > 0;
 return !defended || attack < V[p.type];
}

export type MoveFacts = {
 san: string; piece: PieceSymbol; from: Square; to: Square; color: Color;
 captured?: PieceSymbol; free?: boolean; recapturedBy?: PieceSymbol;
 check: boolean; mate: boolean; castle?: 'k' | 'q'; promotion?: PieceSymbol;
 targets: Pc[]; fork: boolean;
 pins: { pinned: Pc; behind: Pc }[]; skewers: { front: Pc; behind: Pc }[];
 discovered: { by: Pc; target: Pc }[];
 hangs: boolean; leavesHanging: Pc[]; attacksLoose: Pc[];
 develops: boolean; centre: boolean; rim: boolean;
};

const DIRS: Record<string, number[][]> = { b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]], q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]] };

function rays(g: Chess, from: Square, type: PieceSymbol, color: Color) {
 const pins: { pinned: Pc; behind: Pc }[] = [], skewers: { front: Pc; behind: Pc }[] = [];
 if (!DIRS[type]) return { pins, skewers };
 const f0 = from.charCodeAt(0) - 97, r0 = Number(from[1]) - 1;
 for (const [df, dr] of DIRS[type]) {
  const seen: Pc[] = [];
  for (let f = f0 + df, r = r0 + dr; f >= 0 && f < 8 && r >= 0 && r < 8 && seen.length < 2; f += df, r += dr) {
   const p = g.get(sqName(f, r)); if (p) seen.push({ sq: sqName(f, r), type: p.type, color: p.color });
  }
  if (seen.length === 2 && seen[0].color !== color && seen[1].color !== color) {
   const [a, b] = seen;
   if (V[b.type] > V[a.type] && V[a.type] >= 3 && (b.type === 'k' || V[b.type] >= 5)) pins.push({ pinned: a, behind: b });
   else if (V[a.type] > V[b.type] && V[b.type] >= 3) skewers.push({ front: a, behind: b });
  }
 }
 return { pins, skewers };
}

export function moveFacts(fen: string, uci: string): MoveFacts | null {
 try {
  const before = new Chess(fen), after = new Chess(fen);
  const mover = before.turn(), enemy = other(mover);
  const m = after.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  const san = m.san, to = m.to as Square;
  const facts: MoveFacts = { san, piece: m.piece, from: m.from as Square, to, color: mover, check: san.includes('+'), mate: san.includes('#'), targets: [], fork: false, pins: [], skewers: [], discovered: [], hangs: false, leavesHanging: [], attacksLoose: [], develops: false, centre: false, rim: false };
  if (m.captured) {
   facts.captured = m.captured;
   const re = after.attackers(to, enemy);
   facts.free = re.length === 0;
   if (re.length) facts.recapturedBy = after.get(re.sort((a, b) => V[after.get(a)!.type] - V[after.get(b)!.type])[0])!.type;
  }
  if (m.flags.includes('k')) facts.castle = 'k'; else if (m.flags.includes('q')) facts.castle = 'q';
  if (m.promotion) facts.promotion = m.promotion;
  const moved: Pc = { sq: to, type: m.promotion ?? m.piece, color: mover };
  // what the moved piece now attacks
  for (const e of piecesOf(after, enemy)) {
   if (!after.attackers(e.sq, mover).includes(to)) continue;
   const worth = e.type === 'k' || V[e.type] > V[moved.type] || after.attackers(e.sq, enemy).length === 0;
   if (worth && e.type !== 'p') facts.targets.push(e);
   if (e.type !== 'k' && e.type !== 'p' && after.attackers(e.sq, enemy).length === 0 && !m.captured) facts.attacksLoose.push(e);
  }
  facts.fork = facts.targets.length >= 2;
  const r = rays(after, to, moved.type, mover); facts.pins = r.pins; facts.skewers = r.skewers;
  // discovered attacks by other sliders of the mover
  for (const s of piecesOf(after, mover)) {
   if (s.sq === to || !DIRS[s.type]) continue;
   for (const e of piecesOf(after, enemy)) {
    if (e.type === 'p') continue;
    const now = after.attackers(e.sq, mover).includes(s.sq), was = before.attackers(e.sq, mover).includes(s.sq);
    if (now && !was && (e.type === 'k' || V[e.type] >= 3)) facts.discovered.push({ by: s, target: e });
   }
  }
  // safety of the moved piece and of everything else
  const attackerV = cheapest(after, to, enemy);
  const lost = m.captured ? V[m.captured] : 0;
  if (attackerV && moved.type !== 'k' && (after.attackers(to, mover).length === 0 || attackerV < V[moved.type]) && lost < V[moved.type]) facts.hangs = true;
  for (const p of piecesOf(after, mover)) if (p.sq !== to && enPrise(after, p) && !enPrise(before, { ...p })) facts.leavesHanging.push(p);
  const back = mover === 'w' ? '1' : '8';
  facts.develops = (m.piece === 'n' || m.piece === 'b') && m.from[1] === back && before.moveNumber() <= 12;
  facts.centre = ['d4', 'e4', 'd5', 'e5'].includes(to) && (m.piece === 'p' || m.piece === 'n');
  facts.rim = m.piece === 'n' && (to[0] === 'a' || to[0] === 'h');
  return facts;
 } catch { return null; }
}

const list = (ps: Pc[]) => ps.map(label).join(' and ');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Why this move is good. Most forcing reasons first.
export function whyGood(f: MoveFacts, side = f.color === 'w' ? 'White' : 'Black'): string[] {
 const out: string[] = []; const foe = f.color === 'w' ? 'Black' : 'White';
 if (f.mate) { out.push(f.captured ? `It is checkmate, and it captures a ${pieceName(f.captured)} on the way.` : 'It is checkmate.'); return out; }
 if (f.promotion) out.push(`It promotes the pawn to a ${pieceName(f.promotion)}.`);
 if (f.captured) {
  if (f.free) out.push(`It wins a ${pieceName(f.captured)} for nothing: nothing can recapture on ${f.to}.`);
  else if (f.recapturedBy && V[f.captured] > V[f.piece]) out.push(`It captures a ${pieceName(f.captured)} with a ${pieceName(f.piece)}, winning material even though ${foe} can recapture.`);
  else if (f.recapturedBy) out.push(`It trades a ${pieceName(f.piece)} for a ${pieceName(f.captured)}.`);
 }
 if (f.fork) out.push(`It forks the ${list(f.targets)}: both are attacked at once and ${foe} can only save one.`);
 for (const p of f.pins.slice(0, 1)) out.push(`It pins the ${label(p.pinned)} to the ${label(p.behind)}, so it cannot move freely.`);
 for (const s of f.skewers.slice(0, 1)) out.push(`It skewers the ${label(s.front)} against the ${label(s.behind)}: when the front piece moves, the one behind is lost.`);
 for (const d of f.discovered.slice(0, 1)) out.push(`It uncovers an attack by the ${label(d.by)} on the ${label(d.target)}.`);
 if (f.check && !f.mate) out.push(`It gives check, so ${foe} must respond.`);
 if (!f.fork && !f.captured) for (const e of f.attacksLoose.slice(0, 1)) out.push(`It attacks the undefended ${label(e)}.`);
 if (f.castle) out.push('It castles: the king is tucked away and a rook joins the game.');
 if (f.develops) out.push(`It develops the ${pieceName(f.piece)}, bringing a new piece into play.`);
 if (f.centre && !out.length) out.push(`It puts a ${pieceName(f.piece)} on ${f.to}, a central square.`);
 if (!out.length) out.push('It keeps your position safe and improves your pieces without giving anything away.');
 void side; return out;
}

// Why this move is poor, from the facts of the move itself.
export function whyBad(f: MoveFacts): string[] {
 const out: string[] = [];
 if (f.hangs) out.push(`It puts the ${pieceName(f.piece)} on ${f.to} where it can simply be captured.`);
 for (const p of f.leavesHanging.slice(0, 2)) out.push(`It leaves the ${label(p)} unprotected.`);
 if (f.rim && !out.length) out.push(`It puts the knight on ${f.to}, on the edge of the board, where it controls few squares.`);
 return out;
}

// Material swing (in pawns) for the side that plays pv[0], within the line, plus what happens.
export function walkPv(fen: string, pv: string[], maxPlies = 8) {
 const g = new Chess(fen); const mover = g.turn(); const sans: string[] = []; let swing = 0; let mate = false; let check = false;
 let firstReply: { san: string; captured?: PieceSymbol; check: boolean; piece: PieceSymbol; to: Square } | undefined;
 for (const [i, u] of pv.slice(0, maxPlies).entries()) {
  let m; try { m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; }
  sans.push(m.san);
  if (m.captured) swing += (m.color === mover ? 1 : -1) * V[m.captured];
  if (m.promotion) swing += (m.color === mover ? 1 : -1) * (V[m.promotion] - 1);
  if (i === 1) firstReply = { san: m.san, captured: m.captured, check: m.san.includes('+') || m.san.includes('#'), piece: m.piece, to: m.to as Square };
  if (i === 0) check = m.san.includes('+');
  if (g.isCheckmate()) { mate = true; break; }
 }
 return { sans, swing, mate, firstReply, check, matedSide: mate ? (g.turn() === mover ? 'you' : 'them') : undefined };
}

const fmtLine = (fen: string, sans: string[]) => {
 const g = new Chess(fen); let n = g.moveNumber(); let white = g.turn() === 'w'; const out: string[] = [];
 sans.forEach((s, i) => { out.push(white ? `${n}. ${s}` : (i === 0 ? `${n}… ${s}` : s)); if (!white) n++; white = !white; });
 return out.join(' ');
};
export const lineText = fmtLine;

const pawns = (cp: number) => Math.abs(cp / 100).toFixed(1);
// Score from the mover's point of view in pawns (mate = large).
export const scoreFor = (line: PvLine, color: Color) => { const w = line.mate !== undefined ? (line.mate > 0 ? 1 : -1) * 100 - (line.mate || 0) * 0.01 : line.cp / 100; return color === 'w' ? w : -w; };

export type Comparison = { headline: string; better: string[]; worse: string[]; habit: string[]; lineBetter: string; lineWorse: string };

// Explains why `better` is stronger than `worse` (both are lines starting with the move in question).
export function compareMoves(fen: string, better: PvLine, worse: PvLine, extra: { playedByUser?: boolean } = {}): Comparison {
 const color = new Chess(fen).turn();
 const bf = moveFacts(fen, better.pv[0]), wf = moveFacts(fen, worse.pv[0]);
 const bw = walkPv(fen, better.pv), ww = walkPv(fen, worse.pv);
 const gain = scoreFor(better, color) - scoreFor(worse, color);
 const bestSan = bf?.san ?? better.pv[0], worseSan = wf?.san ?? worse.pv[0];
 const bothMate = better.mate !== undefined && better.mate > 0 === (color === 'w');
 const headline = gain >= 90 ? `${bestSan} wins and ${worseSan} does not.` : gain < 0.15 ? `${bestSan} and ${worseSan} are about equally good.` : `${bestSan} is better than ${worseSan} by about ${gain.toFixed(1)} pawns.`;
 const bet: string[] = bf ? whyGood(bf) : [];
 if (bw.mate && bw.matedSide === 'them') bet.push(`The line ${fmtLine(fen, bw.sans)} ends in checkmate.`);
 else if (bw.swing >= 1) bet.push(`After ${fmtLine(fen, bw.sans.slice(0, 5))} you are about ${plural(bw.swing, 'pawn')} of material up.`);
 const wor: string[] = wf ? whyBad(wf) : [];
 if (ww.mate && ww.matedSide === 'you') wor.push(`It allows ${fmtLine(fen, ww.sans.slice(0, 6))}, which is checkmate against you.`);
 else if (ww.swing <= -1) wor.push(`It loses material: after ${fmtLine(fen, ww.sans.slice(0, 5))} you are about ${plural(-ww.swing, 'pawn')} down.`);
 if (bw.mate && bw.matedSide === 'them' && !(ww.mate && ww.matedSide === 'them')) wor.push(`It gives up the forced checkmate (${fmtLine(fen, bw.sans.slice(0, 6))}).`);
 if (ww.firstReply && !ww.mate) {
  const r = ww.firstReply;
  if (r.captured) wor.push(`The reply ${r.san} captures your ${pieceName(r.captured)}.`);
  else if (r.check) wor.push(`The reply ${r.san} comes with check and takes the initiative.`);
  else if (wor.length === 0 && gain >= 0.3) wor.push(`After ${r.san}, your opponent gets the more comfortable position.`);
 }
 if (!wor.length) wor.push(gain >= 0.5 ? 'It lets your opponent equalise or take over the initiative, while the better move keeps the advantage.' : 'It is a reasonable move, just slightly less accurate.');
 const habit: string[] = [];
 if (bf && (bf.mate || bf.check || bf.captured) && !(wf && (wf.check || wf.captured))) habit.push(`The best move was a ${bf.mate ? 'checkmate' : bf.check ? 'check' : 'capture'}. Look at checks and captures first.`);
 if (wf && wf.leavesHanging.length + (wf.hangs ? 1 : 0) > 0) habit.push('Before moving, ask: which of my pieces becomes unprotected?');
 if (extra.playedByUser && ww.firstReply?.captured) habit.push('Before moving, ask: what is my opponent’s best reply, and what does it capture?');
 void bothMate;
 return { headline, better: bet, worse: wor, habit, lineBetter: fmtLine(fen, bw.sans.slice(0, 6)), lineWorse: fmtLine(fen, ww.sans.slice(0, 6)) };
}

// Checks, captures, threats: the routine for thinking before every move.
export type Scan = { checks: string[]; captures: { san: string; safe: boolean }[]; threats: string[]; looseOwn: string[]; looseEnemy: string[] };
export function scan(fen: string): Scan {
 const g = new Chess(fen); const me = g.turn(); const foe = other(me);
 const moves = g.moves({ verbose: true });
 const checks = moves.filter(m => m.san.includes('+') || m.san.includes('#')).map(m => m.san);
 const captures = moves.filter(m => m.captured).map(m => { const f = moveFacts(fen, m.from + m.to + (m.promotion ?? '')); return { san: m.san, safe: !!f && !f.hangs }; });
 const threats: string[] = [];
 try {
  const flipped = new Chess(fen.replace(/ [wb] \S+ \S+/, ` ${foe} - -`));
  for (const m of flipped.moves({ verbose: true })) {
   if (m.captured) { const target = flipped.get(m.to as Square)!; const attacker = V[m.piece]; if (!g.attackers(m.to as Square, me).length || V[target.type] > attacker) threats.push(`${m.san} (${pieceName(m.captured)} on ${m.to})`); }
   else if (m.san.includes('#')) threats.push(`${m.san} (checkmate threat)`);
  }
 } catch { /* the opponent would be in check: no threat list */ }
 const looseOwn = piecesOf(g, me).filter(p => p.type !== 'k' && enPrise(g, p)).map(label);
 const looseEnemy = piecesOf(g, foe).filter(p => p.type !== 'k' && g.attackers(p.sq, foe).length === 0).map(label);
 return { checks, captures, threats: threats.slice(0, 6), looseOwn, looseEnemy };
}

export const themeBlurbs: Record<string, string> = {
 fork: 'A fork: one piece attacks two or more targets at once, so the opponent can only save one.',
 pin: 'A pin: a piece cannot move because something more valuable stands behind it.',
 skewer: 'A skewer: a valuable piece is attacked and must move, exposing a piece behind it.',
 discoveredAttack: 'A discovered attack: moving one piece uncovers an attack by another.',
 doubleCheck: 'A double check: two pieces give check at once, so only a king move helps.',
 backRankMate: 'A back-rank mate: the king is trapped behind its own pawns.',
 smotheredMate: 'A smothered mate: a knight mates a king boxed in by its own pieces.',
 hangingPiece: 'A hanging piece: something is undefended and can simply be taken.',
 trappedPiece: 'A trapped piece: a piece has no safe squares and will be won.',
 attraction: 'Attraction: a piece is lured to a square where it can be attacked.',
 deflection: 'Deflection: a defender is forced away from the piece or square it guards.',
 interference: 'Interference: a piece is placed between two enemy pieces to cut their connection.',
 clearance: 'Clearance: a piece moves away to open a line for another.',
 quietMove: 'A quiet move: not a check or capture, but it sets up an unstoppable threat.',
 sacrifice: 'A sacrifice: material is given up for a bigger gain, often a mating attack.',
 zugzwang: 'Zugzwang: every move the opponent can make makes their position worse.',
 xRayAttack: 'An x-ray: a piece attacks through another piece along a line.',
 capturingDefender: 'Removing the defender: take the piece that protects the target.',
 exposedKing: 'An exposed king: the king has little cover, so attacks come quickly.',
 mateIn1: 'Mate in one: a single move ends the game.', mateIn2: 'Mate in two: a forcing sequence of two moves.', mateIn3: 'Mate in three: keep making forcing moves.', mateIn4: 'Mate in four: a longer forced mating sequence.',
 promotion: 'Promotion: a pawn reaches the last rank and becomes a stronger piece.',
 advancedPawn: 'An advanced pawn: a pawn close to promotion ties down the opponent.',
 enPassant: 'En passant: a special pawn capture.', defensiveMove: 'A defensive move: the only way to hold the position.', intermezzo: 'An in-between move: insert a forcing move before the expected reply.',
 endgame: 'An endgame: few pieces remain, so king activity and pawns matter.', pawnEndgame: 'A pawn endgame: kings and pawns only.', rookEndgame: 'A rook endgame.', bishopEndgame: 'A bishop endgame.', knightEndgame: 'A knight endgame.', queenEndgame: 'A queen endgame.',
 kingsideAttack: 'An attack on the kingside.', queensideAttack: 'An attack on the queenside.',
};
const skipThemes = new Set(['short', 'long', 'veryLong', 'oneMove', 'opening', 'middlegame', 'crushing', 'advantage', 'equality', 'master', 'masterVsMaster', 'superGM']);

export type PuzzleStep = { san: string; yours: boolean; lines: string[] };
// Walks a puzzle's stored solution and says what each move does. moves[0] is the opponent's move that starts it.
export function explainPuzzle(fen: string, moves: string, themes: string) {
 const ucis = moves.split(' '); const g = new Chess(fen);
 const steps: PuzzleStep[] = [];
 let prevCheck = false;
 for (const [i, u] of ucis.entries()) {
  const f = moveFacts(g.fen(), u); if (!f) break;
  const yours = i > 0 && i % 2 === 1;
  if (i === 0) { g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); steps.push({ san: f.san, yours: false, lines: ['The opponent’s last move sets the problem.'] }); prevCheck = f.check; continue; }
  const lines = yours ? whyGood(f) : [prevCheck ? 'The only way to deal with the check.' : f.captured ? `The opponent takes your ${pieceName(f.captured)}.` : 'The opponent’s best defence, but it is not enough.'];
  steps.push({ san: f.san, yours, lines });
  g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); prevCheck = f.check;
 }
 const tags = themes.split(' ').filter(t => themeBlurbs[t] && !skipThemes.has(t));
 const ends = g.isCheckmate() ? 'The line ends in checkmate.' : '';
 return { steps, ideas: tags.map(t => themeBlurbs[t]), ends };
}
