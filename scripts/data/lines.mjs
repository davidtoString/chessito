// Regenerates public/data from Lichess CC0 data. Run from the repo root: node scripts/data/lines.mjs (Node 24; needs network).
// Output directory: OUT_DIR (default public/data).
const OUT = process.env.OUT_DIR || "public/data";
import { Chess } from 'chess.js'; import fs from 'node:fs';
const FAMILIES = [
 ['w','Italian Game'],['w','Ruy Lopez'],['w','Scotch Game'],['w','Vienna Game'],['w',"King's Gambit"],['w',"Queen's Gambit"],['w','London System'],['w','English Opening'],['w','Réti Opening'],['w','Catalan Opening'],['w','Four Knights Game'],['w',"Bishop's Opening"],
 ['b','Sicilian Defense'],['b','French Defense'],['b','Caro-Kann Defense'],['b','Scandinavian Defense'],['b','Pirc Defense'],['b','Alekhine Defense'],['b',"King's Indian Defense"],['b','Nimzo-Indian Defense'],['b',"Queen's Gambit Declined"],['b','Slav Defense'],['b','Grünfeld Defense'],['b','Dutch Defense'],['b','Philidor Defense'],['b',"Queen's Indian Defense"],['b','Modern Defense'],
];
const rows = [];
for (const l of 'abcde') { const t = await (await fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/master/${l}.tsv`)).text();
 for (const line of t.split('\n').slice(1)) { const [eco, name, pgn] = line.split('\t'); if (pgn) { const c = new Chess(); try { c.loadPgn(pgn); } catch { continue; } rows.push({ eco, name, pgn, plies: c.history().length }); } } }
const out = []; const summary = [];
for (const [side, fam] of FAMILIES) {
 const m = rows.filter(r => r.name === fam || r.name.startsWith(fam + ':') || r.name.startsWith(fam + ' '));
 const seen = new Set(); const pick = [];
 const base = m.filter(r => r.name === fam).sort((a, b) => b.plies - a.plies)[0] || m.filter(r => r.plies >= 4).sort((a, b) => a.plies - b.plies)[0]; if (base) { pick.push(base); seen.add(base.name); }
 for (const r of m.filter(r => r.plies >= 7 && r.plies <= 20).sort((a, b) => b.plies - a.plies)) { if (pick.length >= 6) break; const key = r.name.split(',')[0]; if (seen.has(key)) continue; seen.add(key); pick.push(r); }
 summary.push(fam + ':' + pick.length);
 pick.forEach((r, i) => out.push({ id: fam.toLowerCase().replace(/[^a-z]+/g, '-') + '-' + i, family: fam, side, eco: r.eco, name: r.name, pgn: r.pgn, plies: r.plies }));
}
fs.writeFileSync(OUT + '/lines.json', JSON.stringify(out));
console.log(out.length, 'lines;', summary.join(' '));
