// Regenerates public/data from Lichess CC0 data. Run from the repo root: node scripts/data/puzzles.mjs (Node 24; needs network).
// Output directory: OUT_DIR (default public/data).
const OUT = process.env.OUT_DIR || "public/data";
import fs from 'node:fs'; import zlib from 'node:zlib'; import readline from 'node:readline'; import { Readable } from 'node:stream';
const res = await fetch('https://database.lichess.org/lichess_db_puzzle.csv.zst');
console.log('status', res.status, res.headers.get('content-length'));
const rl = readline.createInterface({ input: Readable.fromWeb(res.body).pipe(zlib.createZstdDecompress()), crlfDelay: Infinity });
const buckets = new Map(), seen = new Map(); const PER = 160; let lines = 0;
for await (const line of rl) {
 if (lines++ === 0) continue;
 const f = line.split(','); const rating = +f[3], pop = +f[5], plays = +f[6];
 if (!(pop >= 90 && plays >= 500) || rating < 500 || rating >= 2900) continue;
 const b = Math.floor(rating / 100); const k = (seen.get(b) || 0) + 1; seen.set(b, k);
 const arr = buckets.get(b) || []; buckets.set(b, arr);
 const row = { id: f[0], fen: f[1], moves: f[2], rating, themes: f[7] };
 if (arr.length < PER) arr.push(row); else { const j = Math.floor(Math.random() * k); if (j < PER) arr[j] = row; }
}
const all = [...buckets.values()].flat().sort((a, b) => a.rating - b.rating);
fs.writeFileSync(OUT + '/puzzles.json', JSON.stringify(all));
console.log('lines', lines, 'kept', all.length, [...seen.entries()].sort((a,b)=>a[0]-b[0]).map(([b,c])=>b*100+':'+c).join(' '));
