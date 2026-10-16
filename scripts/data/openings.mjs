// Regenerates public/data from Lichess CC0 data. Run from the repo root: node scripts/data/openings.mjs (Node 24; needs network).
// Output directory: OUT_DIR (default public/data).
const OUT = process.env.OUT_DIR || "public/data";
import { Chess } from 'chess.js';
import fs from 'node:fs';
const out = {}; let n = 0;
for (const l of 'abcde') {
 const t = await (await fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/master/${l}.tsv`)).text();
 for (const line of t.split('\n').slice(1)) {
  const [eco, name, pgn] = line.split('\t'); if (!pgn) continue;
  const c = new Chess(); try { c.loadPgn(pgn); } catch { continue; }
  out[c.fen().split(' ').slice(0, 4).join(' ')] = [eco, name]; n++;
 }
}
fs.writeFileSync(OUT + '/openings.json', JSON.stringify(out));
console.log('openings', n, Object.keys(out).length);
