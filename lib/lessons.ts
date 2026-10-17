// Original lessons for Chessito. Every position, demonstration and task is validated by tests/lessons.test.ts.
export type TaskMove = { accept: string[] } | { auto: string };
export type Task = { seq: TaskMove[]; hint: string; success: string; ends?: 'mate'; rule?: boolean };
export type Step = {
 text: string;
 fen?: string;          // defaults to the standard starting position
 setup?: string[];      // SAN moves played silently before the step is shown
 demo?: string[];       // SAN moves the learner can watch ("Show me")
 demoEnds?: 'mate';
 expect?: 'stalemate' | 'check';
 task?: Task;           // UCI moves: { accept } is the learner, { auto } is the reply
 arrows?: [string, string][];
 marks?: string[];
};
export type Category = 'Basics' | 'Tactics' | 'Strategy' | 'Endgames' | 'Openings';
export type Quiz = { q: string; options: string[]; answer: number; why: string };
export type Lesson = { id: string; category: Category; title: string; summary: string; steps: Step[]; quiz?: Quiz[] };

export const categories: Category[] = ['Basics', 'Tactics', 'Strategy', 'Endgames', 'Openings'];

const baseLessons: Lesson[] = [
 // ───────────── Basics ─────────────
 { id: 'pieces', category: 'Basics', title: 'How the pieces move', summary: 'Rook, bishop, knight, queen, king and pawn: one capture each.', steps: [
  { text: 'Every piece moves in its own way, and captures by moving onto an enemy piece. Take the pawn on d7 with your rook. Rooks slide any distance along ranks and files.', fen: '7k/3p4/8/8/3R4/8/8/4K3 w - - 0 1',
   task: { seq: [{ accept: ['d4d7'] }], hint: 'The rook is on d4 and the pawn is straight ahead on d7.', rule: true, success: 'Rooks move in straight lines: up, down, left and right.' }, arrows: [['d4', 'd7']] },
  { text: 'Bishops slide diagonally, so each bishop stays on one colour of square for the whole game. Capture the pawn on g7.', fen: 'k7/6p1/8/8/3B4/8/8/4K3 w - - 0 1',
   task: { seq: [{ accept: ['d4g7'] }], hint: 'Follow the diagonal: e5, f6, g7.', rule: true, success: 'Bishops move diagonally, any distance.' }, arrows: [['d4', 'g7']] },
  { text: 'Knights jump in an L: two squares one way, then one square sideways. They are the only pieces that can jump over others. Capture the pawn on f6.', fen: '7k/8/5p2/8/4N3/8/8/4K3 w - - 0 1',
   task: { seq: [{ accept: ['e4f6'] }], hint: 'From e4: one file right, two ranks up.', rule: true, success: 'Knights jump, so nothing can block them.' }, arrows: [['e4', 'f6']] },
  { text: 'The queen combines rook and bishop: any distance, any straight or diagonal line. Capture the pawn on d5.', fen: '7k/8/8/3p4/8/8/8/3QK3 w - - 0 1',
   task: { seq: [{ accept: ['d1d5'] }], hint: 'The d-file is open all the way up.', rule: true, success: 'The queen is your most powerful piece.' }, arrows: [['d1', 'd5']] },
  { text: 'The king moves one square in any direction. It can capture too, but only a piece that is not protected. Take the loose pawn on d3.', fen: '7k/8/8/8/8/3pK3/8/8 w - - 0 1',
   task: { seq: [{ accept: ['e3d3'] }], hint: 'The pawn is right next to your king.', rule: true, success: 'The king is slow but precious: protect it.' }, arrows: [['e3', 'd3']] },
  { text: 'Pawns move straight ahead but capture diagonally. Capture the pawn on d5 with your e-pawn.', fen: '7k/8/8/3p4/4P3/8/8/4K3 w - - 0 1',
   task: { seq: [{ accept: ['e4d5'] }], hint: 'A pawn captures one square diagonally forward.', rule: true, success: 'Pawns are the only pieces that capture differently from how they move.' }, arrows: [['e4', 'd5']] },
 ] },
 { id: 'check-mate', category: 'Basics', title: 'Check, checkmate and stalemate', summary: 'How games end, and the draw to avoid.', steps: [
  { text: 'A king under attack is in check, and the player must get out of it at once: move the king, block, or capture the attacker. Your king is attacked by the rook. Move it to safety.', fen: '4k3/8/8/8/8/8/8/4RK2 b - - 0 1',
   task: { seq: [{ accept: ['e8d8', 'e8d7'] }], hint: 'Step off the e-file toward the queenside. Kf8 and Kf7 walk into Re8#.', success: 'Escaping check is always the first thing to look at.' }, arrows: [['e1', 'e8']] },
  { text: 'Checkmate: the king is in check and nothing can stop it. The game is over. The black king is boxed in by its own pawns. Deliver mate.', fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
   task: { seq: [{ accept: ['a1a8'] }], ends: 'mate', hint: 'Bring the rook to the back rank.', success: 'Checkmate! This pattern is called a back-rank mate.' }, arrows: [['a1', 'a8']] },
  { text: 'Stalemate: the player to move is not in check but has no legal move. That is a draw, not a win. Here Black has no move at all.', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', expect: 'stalemate', marks: ['h8', 'g8', 'h7', 'g7'] },
 ] },
 { id: 'special-moves', category: 'Basics', title: 'Castling, en passant and promotion', summary: 'The three special rules every player needs.', steps: [
  { text: 'Castling moves the king two squares toward a rook and the rook jumps over to the other side. It tucks the king away and activates the rook. Castle kingside.', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
   task: { seq: [{ accept: ['e1g1'] }], hint: 'Move the king two squares to the right: e1 to g1.', rule: true, success: 'You may not castle out of, through, or into check, and only if neither piece has moved.' }, arrows: [['e1', 'g1'], ['h1', 'f1']] },
  { text: 'En passant: if an enemy pawn jumps two squares and lands beside your pawn, you may capture it as if it had moved one square. You must do it right away. Black just played d7–d5.', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
   task: { seq: [{ accept: ['e5d6'] }], hint: 'Capture diagonally onto d6, the square the pawn skipped.', rule: true, success: 'The pawn on d5 disappears even though you landed on d6.' }, arrows: [['e5', 'd6']] },
  { text: 'A pawn reaching the last rank becomes a queen, rook, bishop or knight. Almost always you choose a queen. Promote now.', fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
   task: { seq: [{ accept: ['a7a8q'] }], hint: 'Move the pawn to a8 and choose a queen.', rule: true, success: 'A new queen, with check. Occasionally a knight is better, which is called underpromotion.' }, arrows: [['a7', 'a8']] },
 ] },
 { id: 'values', category: 'Basics', title: 'Piece values and trades', summary: 'Count material so you know which trades help you.', steps: [
  { text: 'Pieces have rough values: pawn 1, knight 3, bishop 3, rook 5, queen 9. The king cannot be traded. Before every capture, ask whether you are giving up more than you win.' },
  { text: 'A pawn takes a queen: a trade of 1 for 9. Always look for captures where the other side loses more than you do.', fen: '7k/8/8/3q4/4P3/8/8/4K3 w - - 0 1',
   task: { seq: [{ accept: ['e4d5'] }], hint: 'The pawn attacks d5.', success: 'You won a queen for nothing.' }, arrows: [['e4', 'd5']] },
  { text: 'Pieces are worth more than their points when they are active. Two bishops often beat bishop and knight, and a rook on an open file beats a rook stuck behind pawns. Material is a guide, not a law.' },
 ] },
 { id: 'opening-principles', category: 'Basics', title: 'Opening principles', summary: 'Centre, develop, castle: three habits for the first ten moves.', steps: [
  { text: 'Fight for the centre with pawns on e4 or d4. Centre pieces reach both wings quickly.', demo: ['e4', 'e5'], marks: ['d4', 'e4', 'd5', 'e5'] },
  { text: 'Develop knights and bishops toward the centre. Make a useful developing move.', setup: ['e4', 'e5'],
   task: { seq: [{ accept: ['g1f3', 'b1c3', 'f1c4'] }], hint: 'Knights to f3 or c3, or a bishop to c4.', success: 'Developing pieces beats moving pawns around.' } },
  { text: 'Castle early to protect your king and bring a rook into play. The squares between king and rook are clear. Castle.', setup: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
   task: { seq: [{ accept: ['e1g1'] }], hint: 'Move the king two squares toward the h-rook.', success: 'Safe king, active rook. That is the goal of the opening.' } },
  { text: 'Avoid moving the same piece twice or bringing the queen out early. An exposed queen is a target and loses time.' },
 ] },
 { id: 'loose-pieces', category: 'Basics', title: 'Loose pieces drop off', summary: 'Spot undefended pieces and avoid giving them away.', steps: [
  { text: 'A piece with no defender is a loose piece. Before each move, scan for loose pieces on both sides. Black’s bishop is unprotected. Take it.', fen: '4k3/8/8/2b5/8/8/8/2Q1K3 w - - 0 1',
   task: { seq: [{ accept: ['c1c5'] }], hint: 'Look along the c-file.', success: 'Free material. Always ask: what is undefended?' }, arrows: [['c1', 'c5']] },
  { text: 'Check that the piece you capture is not protected. Taking the d7 pawn with the queen looks tempting, but the king guards it. Watch what happens.', fen: '4k3/3p4/8/8/8/8/3Q4/4K3 w - - 0 1', demo: ['Qxd7+', 'Kxd7'] },
 ] },

 // ───────────── Tactics ─────────────
 { id: 'fork', category: 'Tactics', title: 'The fork', summary: 'One piece attacks two things at once.', steps: [
  { text: 'A fork attacks two or more targets with one move. Knights are the best forkers, since their attack pattern is hard to see. Watch the knight on d5 fork king and rook on c7.', fen: 'r3k3/8/1P6/3N4/8/8/8/4K3 w - - 0 1', demo: ['Nc7+', 'Kf7', 'Nxa8'], arrows: [['c7', 'a8'], ['c7', 'e8']] },
  { text: 'Your turn. Fork the black king and queen with your knight.', fen: '3q4/4k3/8/4N3/8/8/8/4K3 w - - 0 1',
   task: { seq: [{ accept: ['e5c6'] }, { auto: 'e7e6' }, { accept: ['c6d8'] }], hint: 'From c6 the knight attacks both e7 and d8.', success: 'A king in check must move, so the queen falls.' }, arrows: [['e5', 'c6']] },
  { text: 'Queens fork too. Find the square that checks the king and attacks the rook along a diagonal, where the rook cannot take back.', fen: '4k3/8/Q7/8/8/7r/8/4K3 w - - 0 1',
   task: { seq: [{ accept: ['a6e6'] }, { auto: 'e8d8' }, { accept: ['e6h3'] }], hint: 'Try e6: it checks along the e-file and hits h3 along a diagonal.', success: 'Check first, capture second. That is how forks win material.' } },
 ] },
 { id: 'pin', category: 'Tactics', title: 'The pin', summary: 'A piece cannot move because something more valuable stands behind it.', steps: [
  { text: 'A pin attacks a piece that cannot move without exposing something more valuable behind it. Here the knight on d7 is pinned to its king by the bishop. If it moves, the king is in check, which makes it illegal.', fen: '4k3/3n4/8/1B6/8/8/8/3RK3 w - - 0 1', arrows: [['b5', 'e8']] },
  { text: 'Pinned pieces cannot defend well and are easy to attack again. Win the pinned knight.', fen: '4k3/3n4/8/1B6/8/8/8/3RK3 w - - 0 1',
   task: { seq: [{ accept: ['d1d7'] }], hint: 'Attack the knight with the rook. The bishop protects it.', success: 'The king cannot recapture because the bishop guards d7.' }, arrows: [['d1', 'd7']] },
 ] },
 { id: 'skewer', category: 'Tactics', title: 'The skewer', summary: 'A pin in reverse: the valuable piece must move, exposing what is behind.', steps: [
  { text: 'A skewer attacks a valuable piece so it has to move, and then captures the piece behind it. Here the rook checks the king on the back rank, with a rook hiding behind.', fen: '3k3r/8/8/8/8/8/8/R3K3 w - - 0 1', demo: ['Ra8+', 'Kc7', 'Rxh8'], arrows: [['a8', 'd8'], ['d8', 'h8']] },
  { text: 'Your turn. Skewer the king and win the rook.', fen: '3k3r/8/8/8/8/8/8/R3K3 w - - 0 1',
   task: { seq: [{ accept: ['a1a8'] }, { auto: 'd8c7' }, { accept: ['a8h8'] }], hint: 'Check from a8, along the back rank.', success: 'Skewers win material because the front piece cannot stay.' } },
 ] },
 { id: 'discovered', category: 'Tactics', title: 'Discovered attacks', summary: 'Move one piece to unleash another.', steps: [
  { text: 'In a discovered attack, a piece steps aside and reveals an attack by the piece behind it. The moving piece can make a threat of its own, so you get two at once. The knight on e5 hides the rook from the king.', fen: '3qk3/8/8/4N3/8/8/8/4R1K1 w - - 0 1', arrows: [['e1', 'e8']] },
  { text: 'Move the knight with a discovered check, and attack the queen at the same time.', fen: '3qk3/8/8/4N3/8/8/8/4R1K1 w - - 0 1',
   task: { seq: [{ accept: ['e5c6'] }, { auto: 'e8d7' }, { accept: ['c6d8'] }], hint: 'From c6 the knight attacks d8, and the rook now checks along the e-file.', success: 'Black had to answer the check, so the queen was lost.' }, demoEnds: undefined },
 ] },
 { id: 'double-check', category: 'Tactics', title: 'Double check', summary: 'Two pieces check at once. Only the king can move.', steps: [
  { text: 'A double check is the most forcing move in chess. Two pieces give check at the same time, so blocking or capturing cannot solve both. The king must move. The knight on e4 blocks its own rook.', fen: '4k3/8/8/8/1B2N3/8/8/4R1K1 w - - 0 1', arrows: [['e1', 'e8']] },
  { text: 'Play the double check.', fen: '4k3/8/8/8/1B2N3/8/8/4R1K1 w - - 0 1',
   task: { seq: [{ accept: ['e4d6'] }], hint: 'The knight goes to d6 and uncovers the rook.', success: 'Knight and rook both check. The bishop protects the knight, so the king must run.' }, arrows: [['e4', 'd6']] },
 ] },
 { id: 'back-rank', category: 'Tactics', title: 'Back-rank mate', summary: 'The most common mate: a king trapped behind its own pawns.', steps: [
  { text: 'When a king sits behind unmoved pawns, a rook or queen on the back rank can be checkmate. Deliver it.', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
   task: { seq: [{ accept: ['e1e8'] }], ends: 'mate', hint: 'Rook to the eighth rank.', success: 'The pawns that protect the king also trap it.' }, arrows: [['e1', 'e8']] },
  { text: 'Defend against it. White threatens Rd8#. Give your king an escape square.', fen: '6k1/5ppp/8/r7/8/8/5PPP/3R2K1 b - - 0 1',
   task: { seq: [{ accept: ['h7h6', 'g7g6', 'f7f6'] }], hint: 'Move a pawn in front of the king. This is called making luft.', success: 'Luft gives the king a flight square.' }, arrows: [['d1', 'd8']] },
  { text: 'A trade can be the mating move when the defender has no other piece. Take on c8 with check.', fen: '2r3k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1',
   task: { seq: [{ accept: ['c1c8'] }], ends: 'mate', hint: 'Rxc8+, and nothing can recapture.', success: 'Checkmate. The defending rook was the only guard.' } },
 ] },
 { id: 'smothered', category: 'Tactics', title: 'Smothered mate', summary: 'A knight mates a king trapped by its own pieces.', steps: [
  { text: 'A knight can give mate when the king is surrounded by its own pieces, because no friendly piece can capture the knight. Find it.', fen: '6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1',
   task: { seq: [{ accept: ['e5f7'] }], ends: 'mate', hint: 'The knight jumps to f7, next to the king’s corner.', success: 'Smothered mate. The rook and pawns took away every escape.' }, arrows: [['e5', 'f7']] },
 ] },
 { id: 'scholars', category: 'Tactics', title: 'Scholar’s mate and how to stop it', summary: 'The four-move trap beginners fall for, and the easy defence.', steps: [
  { text: 'White attacks f7, the weakest square near the Black king, with queen and bishop. If Black ignores it, the game ends in four moves.', demo: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'], demoEnds: 'mate', arrows: [['c4', 'f7'], ['h5', 'f7']] },
  { text: 'Black to move. White threatens Qxf7#. Defend.', setup: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4'],
   task: { seq: [{ accept: ['g7g6', 'd8e7', 'g8h6', 'd8f6'] }], hint: 'Kick the queen with g6, or guard f7 with the queen or knight.', success: 'Well defended. Develop and keep an eye on f7.' }, arrows: [['c4', 'f7']] },
 ] },

 // ───────────── Strategy ─────────────
 { id: 'centre', category: 'Strategy', title: 'Control the centre', summary: 'Why e4, d4, e5 and d5 matter so much.', steps: [
  { text: 'Pieces in the centre control more squares and reach both wings quickly. A knight on the rim attacks only 4 squares, but 8 in the centre. Pawns on d4 and e4 claim the middle.', demo: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], marks: ['d4', 'e4', 'd5', 'e5'] },
  { text: 'Make a centre pawn move.', task: { seq: [{ accept: ['e2e4', 'd2d4'] }], hint: 'The two best first moves are e4 and d4.', success: 'Both open lines for the queen and a bishop.' } },
 ] },
 { id: 'development', category: 'Strategy', title: 'Develop with purpose', summary: 'Every move should add a piece to the game.', steps: [
  { text: 'In the Italian Game, every move develops a piece or fights for the centre. Count how many pieces are active after six moves.', demo: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4'], arrows: [['c4', 'f7']] },
  { text: 'Whoever finishes developing first often wins the first attack. Do not waste time on pawn moves on the wing, repeating piece moves or grabbing pawns that open lines for the opponent.' },
 ] },
 { id: 'king-safety', category: 'Strategy', title: 'King safety', summary: 'An uncastled king in the centre is a target.', steps: [
  { text: 'In this line Black grabs material but cannot castle, and its king gets dragged into the middle of the board. Watch White sacrifice a knight and attack. This is the Fried Liver idea.', demo: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+', 'Ke6', 'Nc3'], arrows: [['f3', 'f7']] },
  { text: 'Lesson: castle early, and never leave your king in the centre once files open. When the opponent’s king is stuck in the middle, open the position and attack.' },
 ] },
 { id: 'outpost', category: 'Strategy', title: 'Outposts', summary: 'A square an enemy pawn can never attack is a home for a knight.', steps: [
  { text: 'An outpost is a square deep in enemy territory that no enemy pawn can attack, ideally protected by your own pawn. Knights love them. Black has no pawn on c or e, so d5 is safe. Place your knight there.', fen: '4k3/pp3ppp/8/8/2P1P3/2N5/PP3PPP/4K3 w - - 0 1',
   task: { seq: [{ accept: ['c3d5'] }], hint: 'Jump to d5, protected by two pawns.', success: 'A knight on an outpost can dominate the whole game.' }, arrows: [['c3', 'd5']] },
 ] },
 { id: 'open-files', category: 'Strategy', title: 'Rooks belong on open files', summary: 'Put your rooks where the pawns have gone.', steps: [
  { text: 'Rooks are strongest on files with no pawns, where they can reach the enemy position. Put your rook on an open file.', fen: 'r3k3/pp3ppp/8/8/8/8/PP3PPP/R3K3 w - - 0 1',
   task: { seq: [{ accept: ['a1d1', 'a1c1'] }], hint: 'The c-, d- and e-files have no pawns.', success: 'Rooks on open files create threats on the seventh and eighth ranks.' }, marks: ['c1', 'd1'] },
  { text: 'A rook on the seventh rank, behind the enemy pawns, is another goal. It attacks pawns from the side and traps the king.' },
 ] },
 { id: 'passed-pawn', category: 'Strategy', title: 'Passed pawns', summary: 'A pawn with no enemy pawn in its way is a long-term asset.', steps: [
  { text: 'A passed pawn has no enemy pawns in front of it or on adjacent files. It can walk to promotion. Pieces should block it, or support it. Push the pawn, with your king close behind.', fen: '4k3/8/8/8/3P4/8/8/4K3 w - - 0 1',
   task: { seq: [{ accept: ['d4d5'] }], hint: 'Just advance it one square.', success: 'In endgames, a passed pawn often decides the game. “Passed pawns must be pushed.”' } },
 ] },

 // ───────────── Endgames ─────────────
 { id: 'queen-mate', category: 'Endgames', title: 'Mate with king and queen', summary: 'Two quick finishes. The full technique comes after.', steps: [
  { text: 'With queen and king against a bare king, the queen restricts the enemy king and your king helps deliver mate. Here the queen mates on g7, protected by the king.', fen: '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1',
   task: { seq: [{ accept: ['g1g7'] }], ends: 'mate', hint: 'Go to g7: the king protects it.', success: 'Always protect the queen when mating.' }, arrows: [['g1', 'g7']] },
  { text: 'Another pattern: the king stands two squares from the enemy king, and the queen mates on the edge.', fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1',
   task: { seq: [{ accept: ['h1h8'] }], ends: 'mate', hint: 'The whole eighth rank is open.', success: 'The black king has no escape: your king covers a7 and b7.' } },
 ] },
 { id: 'rook-mate', category: 'Endgames', title: 'Mate with king and rook', summary: 'Rook plus king cut off the edge.', steps: [
  { text: 'The rook mates along the edge while the king takes away the squares next to it. Finish the job.', fen: 'k7/7R/1K6/8/8/8/8/8 w - - 0 1',
   task: { seq: [{ accept: ['h7h8'] }], ends: 'mate', hint: 'Rook to the eighth rank.', success: 'The king on b6 covers a7 and b7.' }, arrows: [['h7', 'h8']] },
 ] },
 { id: 'stalemate-tricks', category: 'Endgames', title: 'Do not stalemate', summary: 'The most painful way to throw away a win.', steps: [
  { text: 'You are winning with king and queen, but a careless queen move can leave Black with no legal moves, and the game is drawn. Find the mating move.', fen: '7k/8/5K2/6Q1/8/8/8/8 w - - 0 1',
   task: { seq: [{ accept: ['g5g7'] }], ends: 'mate', hint: 'Not Qg6?, which is stalemate. Look for a mate protected by the king.', success: 'Qg7# is mate. Qg6?? would have been stalemate.' } },
  { text: 'Before every move in a winning endgame, ask: does my opponent still have a legal move? Always leave the king a square, or give check.' },
 ] },
 { id: 'opposition', category: 'Endgames', title: 'The king and pawn endgame', summary: 'Opposition: kings face each other, and the side to move gives way.', steps: [
  { text: 'In king and pawn endings the king must lead the pawn. Here White’s king stands in front of the pawn on the sixth rank, which wins by force. Watch the plan.', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', demo: ['Kd6', 'Kd8', 'e6', 'Ke8', 'e7', 'Kf7', 'Kd7'] },
  { text: 'Your turn. Step aside with the king so the pawn can advance.', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
   task: { seq: [{ accept: ['e6d6'] }, { auto: 'e8d8' }, { accept: ['e5e6'] }], hint: 'Move the king diagonally forward, to d6.', success: 'The pawn now walks to promotion with the king guiding it.' } },
 ] },

 // ───────────── Openings ─────────────
 { id: 'op-italian', category: 'Openings', title: 'Italian Game', summary: 'Quick development and an eye on f7.', steps: [
  { text: 'White develops the knight and bishop to attack f7. The plan is c3 and d4 to build a big centre.', demo: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+'], arrows: [['c4', 'f7']] },
  { text: 'Practise the Italian lines in Learn → Openings.' },
 ] },
 { id: 'op-ruy', category: 'Openings', title: 'Ruy Lopez', summary: 'The classic: pressure on the knight that guards e5.', steps: [
  { text: 'The bishop attacks the knight that defends e5. White castles and later plays c3 and d4.', demo: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'], arrows: [['b5', 'c6']] },
 ] },
 { id: 'op-sicilian', category: 'Openings', title: 'Sicilian Defence', summary: 'Black’s most ambitious reply to 1.e4.', steps: [
  { text: 'Black trades the c-pawn for White’s d-pawn, leading to an unbalanced position. White gets the centre; Black gets the c-file and queenside play. This is the Najdorf set-up.', demo: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
 ] },
 { id: 'op-french', category: 'Openings', title: 'French Defence', summary: 'A solid pawn chain and a counterattack on d4.', steps: [
  { text: 'Black builds a pawn chain with e6 and d5, then attacks the base of White’s chain with c5. The light-squared bishop is the long-term problem piece.', demo: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4', 'e5', 'c5', 'a3', 'Bxc3+'] },
 ] },
 { id: 'op-caro', category: 'Openings', title: 'Caro-Kann Defence', summary: 'Solid and sensible: develop the bishop before ...e6.', steps: [
  { text: 'Black prepares d5 with c6, then gets the light-squared bishop out before closing the pawn chain. A very solid choice.', demo: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6'] },
 ] },
 { id: 'op-qgd', category: 'Openings', title: 'Queen’s Gambit Declined', summary: 'Hold the centre with ...e6 and develop calmly.', steps: [
  { text: 'White offers a pawn with c4, and Black declines with e6, keeping a strong centre. Later Black can play ...c5 or ...b6.', demo: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O'] },
 ] },
 { id: 'op-london', category: 'Openings', title: 'London System', summary: 'A simple set-up that works against almost anything.', steps: [
  { text: 'White develops the bishop outside the pawn chain, then plays e3, Nf3, c3, Nbd2. Easy to learn and hard to crack.', demo: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3', 'O-O'] },
 ] },
 { id: 'op-kid', category: 'Openings', title: 'King’s Indian Defence', summary: 'Let White build a big centre, then attack it.', steps: [
  { text: 'Black fianchettoes the bishop on g7, castles, then hits the centre with ...e5 or ...c5. A fighting defence with attacking chances.', demo: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O'] },
 ] },
];

const extraLessons: Lesson[] = [
 // ───────────── More tactics ─────────────
 { id: 'deflection', category: 'Tactics', title: 'Deflection', summary: 'Drag a key defender away from its job.', steps: [
  { text: 'A deflection forces a defender to leave the square or line it protects. Black’s rook on f8 guards the queen on d8. Sacrifice your queen to pull it away, and finish with the rook.', fen: '3q1rk1/5ppp/8/8/8/3Q4/5PPP/3R2K1 w - - 0 1',
   task: { seq: [{ accept: ['d3d8'] }, { auto: 'f8d8' }, { accept: ['d1d8'] }], ends: 'mate', hint: 'Take the queen on d8 with your queen. If the rook recaptures, the d-file opens.', success: 'The rook was overloaded: it could not both guard d8 and the back rank.' }, arrows: [['d3', 'd8']] },
  { text: 'Look for pieces with two jobs. If you can force one of them to leave, the other job is left undone.' },
 ] },
 { id: 'legal-trap', category: 'Tactics', title: 'Légal’s trap', summary: 'A classic queen sacrifice that ends in a smothered-looking mate.', steps: [
  { text: 'Black pins the knight on f3 and expects to win the queen. White ignores the threat, plays Nxe5, and after ...Bxd1 delivers mate with minor pieces. Watch the whole trap.', demo: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'], demoEnds: 'mate', arrows: [['c4', 'f7']] },
  { text: 'Black should not grab the queen: ...dxe5 or ...Bxe5 keeps material. The moral: a free piece is a warning. Ask what your opponent wants you to take.' },
 ] },
 { id: 'mate-patterns', category: 'Tactics', title: 'Two classic mates', summary: 'The Arabian and Anastasia’s mates: a rook and a knight working together.', steps: [
  { text: 'Arabian mate: a rook on the seventh rank next to the corner king, with a knight guarding the rook and covering the escape. Deliver it.', fen: '7k/8/5N2/8/8/8/8/K6R w - - 0 1',
   task: { seq: [{ accept: ['h1h7'] }], ends: 'mate', hint: 'Rook up the h-file to h7: the knight protects it.', success: 'The knight guards h7 and takes g8 away.' }, arrows: [['h1', 'h7']] },
  { text: 'Anastasia’s mate: the knight covers two escape squares, a pawn blocks a third, and the rook gives check along the file. Bring the rook round.', fen: '8/4N1pk/8/8/8/8/2K5/R7 w - - 0 1',
   task: { seq: [{ accept: ['a1h1'] }], ends: 'mate', hint: 'Swing the rook to the h-file.', success: 'The black pawn on g7 helped to trap its own king.' }, arrows: [['a1', 'h1']] },
 ] },

 // ───────────── More strategy ─────────────
 { id: 'pawn-structure', category: 'Strategy', title: 'Pawn structure', summary: 'Isolated and doubled pawns: why they are weak.', steps: [
  { text: 'An isolated pawn has no friendly pawns on adjacent files, so no pawn can ever defend it. Black’s pawn on d5 is isolated. The square in front of it, d4, is a perfect blockade square for a knight.', fen: '4k3/pp3ppp/8/3p4/8/8/PP3PPP/4K3 w - - 0 1', marks: ['d5', 'd4'] },
  { text: 'Doubled pawns are two pawns of the same colour on one file. They cannot protect each other and often block pieces. White’s pawns on c2 and c3 are doubled. Sometimes they are worth having, if you gain the bishop pair or an open file.', fen: '4k3/pp3ppp/8/8/8/2P5/PPP2PPP/4K3 w - - 0 1', marks: ['c2', 'c3'] },
  { text: 'Before trading pieces, look at what the pawn structure will become. Good structures give pieces outposts; bad ones give the opponent targets.' },
 ] },
 { id: 'bishops', category: 'Strategy', title: 'Good and bad bishops', summary: 'Your pawns decide how strong a bishop is.', steps: [
  { text: 'A bishop is bad when its own pawns stand on the same colour of squares, blocking it. White’s dark-squared bishop on c1 is hemmed in by pawns on c3, d4 and e3.', fen: '4k3/5pp1/2p1p3/3p4/3P4/2P1P3/5PP1/2B1K3 w - - 0 1', marks: ['c3', 'd4', 'e3', 'c1'] },
  { text: 'Fix a bad bishop by trading it, or by getting it outside the pawn chain, as in the London System where the bishop develops before e3. The bishop pair, two bishops against bishop and knight, is a long-term advantage in open positions.' },
 ] },
 { id: 'seventh-rank', category: 'Strategy', title: 'The rook on the seventh', summary: 'A rook behind enemy pawns is worth far more than its points.', steps: [
  { text: 'A rook on the seventh rank attacks pawns from the side and cuts the king off. Black’s pawns are on the seventh. Put your rook there.', fen: '5k2/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1',
   task: { seq: [{ accept: ['d1d7'] }], hint: 'Go up the open d-file to d7.', success: 'The rook attacks b7 and f7 at once.' }, arrows: [['d1', 'd7']] },
 ] },
 { id: 'king-endgame', category: 'Strategy', title: 'Activate the king', summary: 'In the endgame the king becomes a fighting piece.', steps: [
  { text: 'With queens gone, the king is safe and strong. Bring it toward the centre and toward the action before pushing pawns. Centralise.', fen: '8/ppp2k2/8/8/8/8/PPP2K2/8 w - - 0 1',
   task: { seq: [{ accept: ['f2e3', 'f2f3'] }], hint: 'March the king toward the middle: e3 or f3.', success: 'The side with the more active king usually wins the pawn race.' } },
 ] },
 { id: 'trades', category: 'Strategy', title: 'Trade when ahead', summary: 'Simplify to convert an advantage; keep pieces when behind.', steps: [
  { text: 'If you are ahead in material, trade pieces, not pawns. Every trade makes your extra material count for more. If you are behind, avoid trades and keep complications.' },
  { text: 'Ask before each trade: does it improve my structure, remove an enemy attacker, or leave me with the better pieces? If not, keep the tension.' },
 ] },
 { id: 'plans', category: 'Strategy', title: 'Making a plan', summary: 'A simple method for quiet positions.', steps: [
  { text: 'When nothing is happening, use this checklist: 1. Where is my worst piece, and where could it be better? 2. What is my opponent threatening? 3. Which pawn breaks help me? 4. Which of their pieces can I trade off or attack?' },
  { text: 'Improve your worst-placed piece first. A rook behind a pawn, a knight on the rim, or a bishop blocked by its own pawns are all candidates. Small improvements add up to a winning position.' },
 ] },

 // ───────────── More endgames ─────────────
 { id: 'rule-square', category: 'Endgames', title: 'The rule of the square', summary: 'Can a lone king catch a running pawn?', steps: [
  { text: 'Imagine a square from the pawn to its promotion square. If the defending king can step inside the square, it catches the pawn. Black’s king on e6 is inside the square of the g5 pawn. Catch it.', fen: '8/8/4k3/6P1/8/8/8/K7 b - - 0 1', marks: ['d5', 'g5', 'g8', 'd8'],
   task: { seq: [{ accept: ['e6f5'] }, { auto: 'g5g6' }, { accept: ['f5g6'] }], hint: 'Step toward the pawn with Kf5 (f6 is covered by the pawn).', success: 'The king stayed inside the square, so the pawn fell.' } },
  { text: 'Here the king is far outside the square. The pawn queens before it can arrive, even though Black moves first.', fen: '8/8/8/6P1/8/8/k7/7K b - - 0 1', demo: ['Kb3', 'Kg2', 'Kc4', 'g6', 'Kd5', 'g7', 'Ke6', 'g8=Q+'], marks: ['g5', 'g8'] },
 ] },
 { id: 'lucena', category: 'Endgames', title: 'The Lucena position', summary: 'How to win a rook ending with a pawn on the seventh.', steps: [
  { text: 'You have a pawn on the seventh and your king in front of it, but the enemy king is cut off and the enemy rook keeps checking. The winning method is to build a bridge: check with the rook, then place it on the fourth rank to shield your king from checks.', fen: '1K1k4/1P6/8/8/8/8/r7/5R2 w - - 0 1' },
  { text: 'Watch the technique: rook checks, bridge on the fourth rank, then the king steps out and the pawn promotes. This is one of the most important endgames to know.', fen: '1K1k4/1P6/8/8/8/8/r7/5R2 w - - 0 1', demo: ['Rd1+', 'Ke7', 'Rd4', 'Ke6', 'Kc7', 'Rc2+', 'Kb6', 'Rg2', 'Kc6', 'Rg8', 'Ra4', 'Ke7', 'Ra8', 'Rg6+', 'Kc7', 'Rg1', 'b8=Q'] },
 ] },
 { id: 'ladder-mate', category: 'Endgames', title: 'Two-rook ladder mate', summary: 'Rooks take turns, walking the king to the edge.', steps: [
  { text: 'With two rooks, one cuts off a rank while the other gives check on the next. The black king is on the edge. Deliver mate.', fen: '7k/R7/8/8/8/8/8/1R4K1 w - - 0 1',
   task: { seq: [{ accept: ['b1b8'] }], ends: 'mate', hint: 'The rook on a7 covers the seventh rank. Check on the eighth.', success: 'Checkmate. One rook covers a rank, the other checks.' }, arrows: [['b1', 'b8']] },
  { text: 'Start from a quiet position. First cover the seventh rank, and the mate follows next move whatever Black does.', fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1',
   task: { seq: [{ accept: ['a2a7'] }, { auto: 'g8f8' }, { accept: ['b1b8'] }], ends: 'mate', hint: 'Put a rook on the seventh rank.', success: 'The ladder: rank by rank, until the king runs out of room.' } },
 ] },
 { id: 'breakthrough', category: 'Endgames', title: 'Pawn breakthrough', summary: 'Sacrifice a pawn to make a passed one.', steps: [
  { text: 'Three white pawns face three black pawns. Neither side seems to have a passer, but a sacrifice creates one. Start the breakthrough.', fen: '7k/8/8/ppp5/PPP5/8/8/7K w - - 0 1',
   task: { seq: [{ accept: ['c4b5', 'a4b5', 'b4c5'] }], hint: 'Capture one of the black pawns, so that a white pawn runs free.', success: 'White now has a passed pawn that Black’s king cannot reach in time.' } },
  { text: 'Watch the pawn run once the structure is broken.', fen: '7k/8/8/ppp5/PPP5/8/8/7K w - - 0 1', demo: ['cxb5', 'c4', 'b6', 'Kg7', 'b7', 'Kf6', 'b8=Q'] },
 ] },

 // ───────────── More openings ─────────────
 { id: 'op-scandi', category: 'Openings', title: 'Scandinavian Defence', summary: 'Challenge e4 at once, and accept an early queen move.', steps: [
  { text: 'Black hits the e4 pawn immediately. After the exchange the queen must move, usually to a5, and Black develops behind it, with a clear plan and few theory lines to learn.', demo: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6'] },
 ] },
 { id: 'op-scotch', category: 'Openings', title: 'Scotch Game', summary: 'Open the centre at once with d4.', steps: [
  { text: 'White opens the centre on move three instead of defending e4 slowly. Pieces get active quickly, and the play is direct.', demo: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nxc6', 'bxc6'] },
 ] },
 { id: 'op-english', category: 'Openings', title: 'English Opening', summary: 'Control d5 from the flank.', steps: [
  { text: 'White starts with c4, fighting for the centre with a flank pawn. It is flexible and often transposes into other openings. Here Black plays the Reversed Sicilian idea ...e5.', demo: ['c4', 'e5', 'Nc3', 'Nf6', 'Nf3', 'Nc6', 'g3', 'd5', 'cxd5', 'Nxd5'] },
 ] },
 { id: 'op-slav', category: 'Openings', title: 'Slav Defence', summary: 'Support d5 with c6 and keep the bishop free.', steps: [
  { text: 'Black defends d5 with the c-pawn, so the light-squared bishop can develop outside the pawn chain. It is solid and has a good reputation at every level.', demo: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4', 'a4', 'Bf5'] },
 ] },
 { id: 'op-nimzo', category: 'Openings', title: 'Nimzo-Indian Defence', summary: 'Pin the knight and fight for e4.', steps: [
  { text: 'Black pins the c3-knight with the bishop to discourage e4, and often trades it to double White’s pawns. Black castles quickly and plays ...d5 or ...c5.', demo: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'O-O', 'Bd3', 'd5'] },
 ] },
 { id: 'op-grunfeld', category: 'Openings', title: 'Grünfeld Defence', summary: 'Let White take the centre, then attack it.', steps: [
  { text: 'Black plays ...d5 and, after White takes on d5, hits the big centre with pieces and the g7 bishop. A sharp counter-attacking system.', demo: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4', 'Nxc3', 'bxc3', 'Bg7'] },
 ] },
 { id: 'op-pirc', category: 'Openings', title: 'Pirc Defence', summary: 'Flexible: fianchetto and strike the centre later.', steps: [
  { text: 'Black lets White build a centre, develops with ...Nf6, ...g6 and ...Bg7, and attacks with ...e5 or ...c5 when ready.', demo: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Nf3', 'Bg7'] },
 ] },
 { id: 'op-catalan', category: 'Openings', title: 'Catalan Opening', summary: 'A queenside fianchetto with lasting pressure on the long diagonal.', steps: [
  { text: 'White combines d4, c4 and a fianchettoed bishop on g2. The bishop pressures the queenside and the d5 pawn for the whole game.', demo: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Be7', 'Nf3', 'O-O'] },
 ] },

];

// Quick multiple-choice questions shown after each lesson.
const quizzes: Record<string, Quiz[]> = {
 'pieces': [{ q: 'Which piece can jump over others?', options: ['Rook', 'Bishop', 'Knight', 'Queen'], answer: 2, why: 'Only the knight jumps.' }, { q: 'How does a pawn capture?', options: ['Straight ahead', 'Diagonally forward', 'Sideways', 'In any direction'], answer: 1, why: 'Pawns move straight but capture diagonally.' }],
 'check-mate': [{ q: 'A player in check must:', options: ['Ignore it if they can capture later', 'Get out of check immediately', 'Offer a draw', 'Move a pawn'], answer: 1, why: 'Move, block or capture the attacker.' }, { q: 'Stalemate means:', options: ['The king is in check with no escape', 'The player to move has no legal move and is not in check', 'A player runs out of time', 'Both sides agree to a draw'], answer: 1, why: 'It is a draw, not a win.' }],
 'special-moves': [{ q: 'Which is true about castling?', options: ['You can castle out of check', 'The king moves two squares toward the rook', 'The rook must have moved first', 'You can castle through an attacked square'], answer: 1, why: 'The king moves two squares and the rook jumps over.' }, { q: 'En passant can only be played:', options: ['Any time later', 'Immediately after the two-square pawn move', 'By a king', 'On the first move only'], answer: 1, why: 'Use it at once or lose the chance.' }],
 'values': [{ q: 'Roughly how many pawns is a rook worth?', options: ['3', '5', '7', '9'], answer: 1, why: 'Rook = 5.' }, { q: 'Piece values are:', options: ['Exact and fixed', 'A rough guide: activity matters too', 'Only for the queen', 'Used only by engines'], answer: 1, why: 'Position and activity change real value.' }],
 'opening-principles': [{ q: 'Which is NOT an opening principle?', options: ['Control the centre', 'Develop knights and bishops', 'Bring the queen out early', 'Castle'], answer: 2, why: 'An early queen becomes a target.' }, { q: 'Why castle early?', options: ['To lose a tempo', 'To protect the king and activate a rook', 'To trap the queen', 'It is required'], answer: 1, why: 'Safe king and a developed rook.' }],
 'loose-pieces': [{ q: 'A loose piece is one that is:', options: ['Very valuable', 'Undefended', 'Pinned', 'On the edge'], answer: 1, why: 'No friendly piece protects it.' }, { q: 'Before capturing, check:', options: ['Whether the target is protected', 'The colour of the square', 'Your clock only', 'Nothing'], answer: 0, why: 'A protected pawn can cost you a queen.' }],
 'fork': [{ q: 'A fork is:', options: ['One piece attacking two targets', 'A piece attacked from behind', 'Giving up a piece', 'A king move'], answer: 0, why: 'Double attack by a single piece.' }, { q: 'Why are knight forks hard to see?', options: ['Knights are small', 'Their L-shaped attacks are unusual', 'They cannot capture', 'They move like bishops'], answer: 1, why: 'The pattern is unlike other pieces.' }],
 'pin': [{ q: 'In an absolute pin, the piece behind is the:', options: ['Queen', 'King', 'Rook', 'Bishop'], answer: 1, why: 'Moving the pinned piece would expose the king.' }, { q: 'A piece absolutely pinned to the king:', options: ['Can move anywhere', 'Cannot legally leave the line of the pin', 'Is always captured', 'Gives check'], answer: 1, why: 'It would put its own king in check.' }],
 'skewer': [{ q: 'In a skewer the more valuable piece is:', options: ['Behind', 'In front', 'Missing', 'Captured first'], answer: 1, why: 'It must move, exposing the piece behind.' }, { q: 'A skewer is like:', options: ['A pin in reverse', 'A fork with pawns', 'Castling', 'Promotion'], answer: 0, why: 'In a pin the less valuable piece is in front.' }],
 'discovered': [{ q: 'A discovered attack reveals an attack by:', options: ['The same piece', 'Another piece behind the mover', 'The king', 'A pawn only'], answer: 1, why: 'Moving one piece opens a line for another.' }, { q: 'The moving piece can:', options: ['Make a threat of its own', 'Never capture', 'Only be a pawn', 'Only be a bishop'], answer: 0, why: 'That creates two threats at once.' }],
 'double-check': [{ q: 'How can you escape a double check?', options: ['Block it', 'Capture a checking piece', 'Move the king', 'Ignore it'], answer: 2, why: 'Two checks cannot be answered at once by anything else.' }, { q: 'Double check means:', options: ['Two kings', 'Two pieces give check at once', 'Check twice in a row', 'Checking the board twice'], answer: 1, why: 'Often from a discovered check.' }],
 'back-rank': [{ q: 'A back-rank mate works because:', options: ['The king has no flight squares', 'The queen is missing', 'The rook is pinned', 'Pawns can capture'], answer: 0, why: 'The king is blocked by its own pawns.' }, { q: 'A simple way to avoid it:', options: ['Make luft', 'Trade queens', 'Castle queenside', 'Resign'], answer: 0, why: 'Move a pawn to give the king a square.' }],
 'smothered': [{ q: 'Which piece delivers a smothered mate?', options: ['Knight', 'Bishop', 'Queen', 'Rook'], answer: 0, why: 'A knight cannot be blocked or captured by the trapped pieces.' }, { q: 'The king is smothered by:', options: ['Its own pieces', 'Enemy pawns', 'A pin', 'The edge only'], answer: 0, why: 'Its own pieces take away its squares.' }],
 'scholars': [{ q: 'Scholar’s mate targets which square?', options: ['f7', 'e5', 'd4', 'c3'], answer: 0, why: 'f7 is defended only by the king at the start.' }, { q: 'A simple defence is:', options: ['...g6, attacking the queen', '...a6', '...h5', '...Na6'], answer: 0, why: 'It also blocks the queen’s diagonal.' }],
 'centre': [{ q: 'Why control the centre?', options: ['Pieces become more mobile', 'It is mandatory', 'To avoid castling', 'To save time on the clock'], answer: 0, why: 'Central pieces reach both wings.' }, { q: 'A knight in the centre attacks up to:', options: ['2 squares', '4 squares', '6 squares', '8 squares'], answer: 3, why: 'On the rim it attacks only 4 or fewer.' }],
 'development': [{ q: 'Good development means:', options: ['Moving the same piece repeatedly', 'Bringing new pieces into play', 'Only pawn moves', 'Moving the king'], answer: 1, why: 'Each move should add a piece.' }, { q: 'Which wastes time?', options: ['Moving a piece twice without need', 'Castling', 'Developing a bishop', 'Fighting for the centre'], answer: 0, why: 'You fall behind in development.' }],
 'king-safety': [{ q: 'Why was Black’s king in danger?', options: ['It was uncastled in the centre', 'It was on a8', 'It had no pawns', 'It was in check at the start'], answer: 0, why: 'Open lines near the king are deadly.' }, { q: 'If the enemy king is in the centre you should:', options: ['Open lines and attack', 'Close the position', 'Trade queens', 'Resign'], answer: 0, why: 'Open the position around the king.' }],
 'outpost': [{ q: 'An outpost is a square that:', options: ['No enemy pawn can attack', 'Is always on the edge', 'Is behind your pawns', 'Is on your first rank'], answer: 0, why: 'Ideally also protected by your own pawn.' }, { q: 'Which piece loves outposts?', options: ['Knight', 'King', 'Queen', 'Rook'], answer: 0, why: 'Knights lack long-range power but are strong when centralised.' }],
 'open-files': [{ q: 'An open file has:', options: ['No pawns', 'Only white pawns', 'The king', 'Only rooks'], answer: 0, why: 'Rooks need open lines.' }, { q: 'A rook on the seventh rank:', options: ['Attacks pawns and confines the king', 'Is weak', 'Cannot move', 'Is always pinned'], answer: 0, why: 'It is deep in enemy territory.' }],
 'passed-pawn': [{ q: 'A passed pawn has:', options: ['No enemy pawns in front on its own or adjacent files', 'Moved two squares', 'Reached the sixth rank', 'A bishop behind it'], answer: 0, why: 'Nothing can stop it by pawn power.' }, { q: 'In endgames passed pawns are often:', options: ['Decisive', 'Irrelevant', 'Weak', 'Illegal'], answer: 0, why: 'They tie down the enemy king.' }],
 'queen-mate': [{ q: 'When mating with queen and king you should:', options: ['Protect the queen', 'Leave your king far away', 'Avoid check', 'Sacrifice the queen'], answer: 0, why: 'Otherwise the king captures it.' }, { q: 'The biggest risk is:', options: ['Stalemate', 'Castling', 'Promotion', 'En passant'], answer: 0, why: 'Always leave the enemy king a move or give check.' }],
 'rook-mate': [{ q: 'The rook mates on:', options: ['The edge of the board', 'The centre', 'Only the a-file', 'The seventh rank only'], answer: 0, why: 'The king is driven to the edge first.' }, { q: 'Your king helps by:', options: ['Taking away flight squares', 'Giving check', 'Staying in the corner', 'Blocking the rook'], answer: 0, why: 'It covers squares next to the enemy king.' }],
 'stalemate-tricks': [{ q: 'When winning, before moving ask:', options: ['Does my opponent still have a legal move?', 'Is the clock low?', 'Can I resign?', 'What is the rating?'], answer: 0, why: 'Stalemate turns a win into a draw.' }, { q: 'Stalemate is:', options: ['A win', 'A draw', 'A loss for the stalemated side', 'Illegal'], answer: 1, why: 'Half a point each.' }],
 'opposition': [{ q: 'In king and pawn endings the king should:', options: ['Lead the pawn', 'Stay home', 'Avoid the pawn', 'Attack the edge'], answer: 0, why: 'The king escorts the pawn.' }, { q: 'With the king in front of the pawn on the sixth rank:', options: ['White usually wins', 'It is always a draw', 'Black wins', 'It is stalemate'], answer: 0, why: 'The king controls the promotion path.' }],
 'op-italian': [{ q: 'In the Italian Game White’s bishop aims at:', options: ['f7', 'a1', 'h8', 'b5'], answer: 0, why: 'The weakest square near the Black king.' }],
 'op-ruy': [{ q: 'The Ruy Lopez bishop attacks:', options: ['The knight on c6', 'The pawn on f7', 'The queen', 'The king'], answer: 0, why: 'It pressures the defender of e5.' }],
 'op-sicilian': [{ q: 'The Sicilian begins 1.e4 and Black plays:', options: ['c5', 'e5', 'e6', 'd5'], answer: 0, why: 'An unbalancing reply that fights for d4.' }],
 'op-french': [{ q: 'The French Defence begins 1.e4 and Black plays:', options: ['e6', 'c6', 'c5', 'd6'], answer: 0, why: 'Followed by ...d5.' }],
 'op-caro': [{ q: 'The Caro-Kann begins 1.e4 and Black plays:', options: ['c6', 'e6', 'c5', 'g6'], answer: 0, why: 'Preparing ...d5 with the bishop free.' }],
 'op-qgd': [{ q: 'In the Queen’s Gambit Declined Black answers 2.c4 with:', options: ['e6', 'dxc4', 'c6', 'Nf6'], answer: 0, why: 'Declining the pawn and holding d5.' }],
 'op-london': [{ q: 'In the London System White’s bishop goes to:', options: ['f4', 'g5', 'h6', 'e3'], answer: 0, why: 'Outside the pawn chain.' }],
 'op-kid': [{ q: 'In the King’s Indian Black’s bishop goes to:', options: ['g7', 'e7', 'b7', 'd6'], answer: 0, why: 'A fianchetto aimed at the centre.' }],
 'deflection': [{ q: 'A deflection works by:', options: ['Pulling a defender away', 'Pinning a pawn', 'Castling', 'Trading queens'], answer: 0, why: 'The target is left unprotected.' }, { q: 'Which piece is a good deflection target?', options: ['One with two jobs', 'A pawn on the edge', 'A king in the corner', 'A piece that cannot move'], answer: 0, why: 'An overloaded defender cannot do both.' }],
 'legal-trap': [{ q: 'In Légal’s trap White:', options: ['Gives up the queen for a mating attack', 'Wins the queen', 'Castles', 'Resigns'], answer: 0, why: 'Bxf7+ and Nd5# follow.' }, { q: 'A free piece offered by the opponent should make you:', options: ['Suspicious', 'Greedy', 'Resign', 'Castle'], answer: 0, why: 'Ask what they want you to take.' }],
 'mate-patterns': [{ q: 'In Arabian mate the rook is protected by a:', options: ['Knight', 'Pawn', 'Bishop', 'Queen'], answer: 0, why: 'The knight also covers g8.' }, { q: 'Anastasia’s mate uses a knight and a:', options: ['Rook', 'Bishop', 'Queen only', 'Second knight'], answer: 0, why: 'The rook checks along the file.' }],
 'pawn-structure': [{ q: 'An isolated pawn has:', options: ['No friendly pawns on adjacent files', 'Two pawns behind it', 'No pawns in front', 'A rook behind it'], answer: 0, why: 'No pawn can ever defend it.' }, { q: 'A good blockade square for a knight is:', options: ['In front of the isolated pawn', 'Behind your king', 'On the edge', 'Next to your queen'], answer: 0, why: 'It stops the pawn advancing.' }],
 'bishops': [{ q: 'A bishop is “bad” when:', options: ['Its own pawns block it on the same colour', 'It is on the edge', 'It is attacked', 'It has moved twice'], answer: 0, why: 'Own pawns on its colour limit it.' }, { q: 'The bishop pair is strongest in:', options: ['Open positions', 'Closed positions', 'Endgames with no pawns only', 'Never'], answer: 0, why: 'Long diagonals are open.' }],
 'seventh-rank': [{ q: 'A rook on the seventh rank:', options: ['Attacks pawns from the side', 'Is useless', 'Protects the king', 'Blocks pawns'], answer: 0, why: 'It also confines the enemy king.' }],
 'king-endgame': [{ q: 'In the endgame the king should:', options: ['Become active', 'Hide in the corner', 'Avoid pawns', 'Stay on e1'], answer: 0, why: 'There are fewer attackers.' }],
 'trades': [{ q: 'When ahead in material you should:', options: ['Trade pieces', 'Trade pawns', 'Avoid all trades', 'Sacrifice'], answer: 0, why: 'Each trade makes the advantage bigger.' }, { q: 'When behind you should:', options: ['Avoid trades and seek complications', 'Trade everything', 'Resign', 'Castle'], answer: 0, why: 'Keep material for counterplay.' }],
 'plans': [{ q: 'A good first step in a quiet position:', options: ['Improve your worst piece', 'Move a random pawn', 'Trade your best piece', 'Offer a draw'], answer: 0, why: 'Small improvements add up.' }, { q: 'Before making a plan check:', options: ['What the opponent threatens', 'The clock only', 'The date', 'Nothing'], answer: 0, why: 'Always consider their threats.' }],
 'rule-square': [{ q: 'The rule of the square tells you:', options: ['Whether a king can catch a pawn', 'Where to castle', 'How to promote', 'When to resign'], answer: 0, why: 'Count the pawn’s moves to promotion.' }, { q: 'If the king is outside the square:', options: ['The pawn queens', 'The king catches it', 'It is a draw', 'It is stalemate'], answer: 0, why: 'The king arrives too late.' }],
 'lucena': [{ q: 'The Lucena winning method is called:', options: ['Building a bridge', 'The fork', 'Triangulation', 'Castling'], answer: 0, why: 'The rook shields the king from checks.' }, { q: 'It applies when your pawn is on the:', options: ['Seventh rank', 'Second rank', 'Fourth rank', 'First rank'], answer: 0, why: 'One step from promotion.' }],
 'ladder-mate': [{ q: 'In the ladder mate one rook:', options: ['Covers a rank while the other checks', 'Is sacrificed', 'Stays at home', 'Blocks the king'], answer: 0, why: 'They alternate up the board.' }],
 'breakthrough': [{ q: 'A pawn breakthrough usually needs:', options: ['A pawn sacrifice', 'A queen sacrifice', 'Castling', 'A stalemate'], answer: 0, why: 'It creates a passed pawn.' }],

 'op-scandi': [{ q: 'In the Scandinavian Black plays 1...', options: ['d5', 'e5', 'c5', 'e6'], answer: 0, why: 'Challenging e4 immediately.' }],
 'op-scotch': [{ q: 'The Scotch opens the centre with:', options: ['3.d4', '3.Bb5', '3.Bc4', '3.c3'], answer: 0, why: 'On move three.' }],
 'op-english': [{ q: 'The English Opening starts with:', options: ['1.c4', '1.e4', '1.d4', '1.f4'], answer: 0, why: 'A flank pawn that fights for d5.' }],
 'op-slav': [{ q: 'In the Slav Black supports d5 with:', options: ['c6', 'e6', 'b6', 'g6'], answer: 0, why: 'Keeping the bishop free.' }],
 'op-nimzo': [{ q: 'In the Nimzo-Indian Black’s bishop pins:', options: ['The knight on c3', 'The pawn on e4', 'The queen', 'The rook'], answer: 0, why: 'This discourages e4.' }],
 'op-grunfeld': [{ q: 'In the Grünfeld Black attacks the centre with:', options: ['Pieces and ...Bg7', 'Only pawns', 'The queen', 'The king'], answer: 0, why: 'After White builds a big centre.' }],
 'op-pirc': [{ q: 'The Pirc Defence uses a fianchetto on:', options: ['g7', 'b7', 'e7', 'a7'], answer: 0, why: '...g6 and ...Bg7.' }],
 'op-catalan': [{ q: 'The Catalan features a bishop on:', options: ['g2', 'f4', 'c4', 'g5'], answer: 0, why: 'A fianchetto on the long diagonal.' }],
};

export const lessons: Lesson[] = [...baseLessons, ...extraLessons].map(l => ({ ...l, quiz: l.quiz ?? quizzes[l.id] }));
export const lessonById = (id: string) => lessons.find(l => l.id === id);
