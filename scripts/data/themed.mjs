// Regenerates public/data from Lichess CC0 data. Run from the repo root: node scripts/data/themed.mjs (Node 24; needs network).
// Output directory: OUT_DIR (default public/data).
const OUT = process.env.OUT_DIR || "public/data";
import fs from 'node:fs'; import zlib from 'node:zlib'; import readline from 'node:readline'; import { Readable } from 'node:stream';
const THEMES = ['fork','pin','skewer','discoveredAttack','doubleCheck','backRankMate','smotheredMate','mateIn1','mateIn2','mateIn3','mateIn4','hangingPiece','trappedPiece','attraction','deflection','interference','clearance','quietMove','sacrifice','zugzwang','xRayAttack','capturingDefender','exposedKing','kingsideAttack','queensideAttack','advancedPawn','promotion','enPassant','defensiveMove','intermezzo','pawnEndgame','rookEndgame','bishopEndgame','knightEndgame','queenEndgame','opening','middlegame','endgame'];
const BANDS = [[500,1000],[1000,1500],[1500,2000],[2000,2700]]; const PER = 14;
const res = await fetch('https://database.lichess.org/lichess_db_puzzle.csv.zst');
const rl = readline.createInterface({ input: Readable.fromWeb(res.body).pipe(zlib.createZstdDecompress()), crlfDelay: Infinity });
const pool = new Map(), seen = new Map(); let n = 0;
for await (const line of rl) {
 if (n++ === 0) continue;
 const f = line.split(','); const rating = +f[3], pop = +f[5], plays = +f[6];
 if (!(pop >= 85 && plays >= 300)) continue;
 const b = BANDS.findIndex(([lo, hi]) => rating >= lo && rating < hi); if (b < 0) continue;
 const themes = f[7].split(' ');
 for (const t of themes) { if (!THEMES.includes(t)) continue;
  const key = t + ':' + b; const k = (seen.get(key) || 0) + 1; seen.set(key, k);
  const arr = pool.get(key) || []; pool.set(key, arr);
  const row = { id: f[0], fen: f[1], moves: f[2], rating, themes: f[7] };
  if (arr.length < PER) arr.push(row); else { const j = Math.floor(Math.random() * k); if (j < PER) arr[j] = row; }
 }
}
const out = {};
for (const t of THEMES) out[t] = BANDS.flatMap((_, b) => pool.get(t + ':' + b) || []).sort((a, b) => a.rating - b.rating);
fs.writeFileSync(OUT + '/themed.json', JSON.stringify(out));
console.log('themes', Object.entries(out).map(([t, a]) => t + ':' + a.length).join(' '));
