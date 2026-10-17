// Opening repertoires for the opening bots. Each line is a whole game prefix in SAN; the bot follows a line
// while the game matches it and then hands over to the engine. Lines serve both colours.
export const books: Record<string, string[][]> = {
 sicilian: [
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5', 'Nb3', 'Be6', 'f3', 'Be7', 'Qd2', 'O-O', 'O-O-O'],
  ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'd6', 'Bg5', 'e6', 'Qd2', 'a6', 'O-O-O', 'Bd7', 'f4', 'Be7'],
  ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'a6', 'Bd3', 'Nf6', 'O-O', 'Qc7', 'Qe2', 'd6', 'c4', 'g6', 'Nc3', 'Bg7'],
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'f3', 'Nc6', 'Qd2', 'O-O', 'Bc4'],
  ['d4', 'Nf6', 'c4', 'c5', 'd5', 'e6', 'Nc3', 'exd5', 'cxd5', 'd6', 'e4', 'g6', 'Nf3', 'Bg7', 'Be2', 'O-O', 'O-O'],
  ['Nf3', 'c5', 'c4', 'Nc6', 'Nc3', 'e5', 'g3', 'g6', 'Bg2', 'Bg7', 'O-O', 'Nge7'],
 ],
 london: [
  ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3', 'O-O', 'Nbd2', 'c5', 'c3', 'Nc6', 'Bd3', 'Qe7'],
  ['d4', 'Nf6', 'Nf3', 'd5', 'Bf4', 'c5', 'e3', 'Nc6', 'c3', 'Qb6', 'Qb3', 'c4', 'Qc2', 'Bf5', 'Qc1', 'e6'],
  ['d4', 'd5', 'Bf4', 'c5', 'e3', 'Nc6', 'c3', 'Nf6', 'Nd2', 'e6', 'Ngf3', 'Bd6', 'Bg3', 'O-O', 'Bd3', 'Qe7'],
  ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4', 'e5', 'c5', 'a3', 'Bxc3+', 'bxc3', 'Ne7', 'Qg4', 'Qc7', 'Qxg7', 'Rg8', 'Qxh7', 'cxd4'],
  ['e4', 'e6', 'd4', 'd5', 'Nd2', 'Nf6', 'e5', 'Nfd7', 'Bd3', 'c5', 'c3', 'Nc6', 'Ne2', 'cxd4', 'cxd4', 'f6'],
  ['c4', 'e6', 'Nc3', 'd5', 'd4', 'Nf6', 'Nf3', 'Be7', 'Bg5', 'O-O', 'e3', 'h6', 'Bh4', 'b6'],
 ],
};
// The book move for the side to play, given the SANs played so far, or null when out of book.
export function bookMove(book: string | undefined, history: string[], rng: () => number = Math.random): string | null {
 const lines = book ? books[book] : undefined; if (!lines) return null;
 const next = lines.filter(l => l.length > history.length && history.every((s, i) => l[i] === s)).map(l => l[history.length]);
 return next.length ? next[Math.floor(rng() * next.length)] : null;
}
