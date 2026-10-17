// Builds public/data/classics.json: iconic games from PGN Mentor (free downloads, https://www.pgnmentor.com) and
// a few online games from Chess.com's public data API (https://www.chess.com/news/view/published-data-api),
// validated with chess.js and evaluated move by move with a native Stockfish.
// Games already in the file are kept; set FORCE=1 to recompute everything, or ONLY=id1,id2 to rebuild some.
// Usage (Node 24, needs `unzip` and a stockfish binary):  STOCKFISH=/usr/games/stockfish node scripts/data/classics.mjs
import { execSync, spawn } from 'node:child_process'; import fs from 'node:fs'; import { Chess } from 'chess.js';
const OUT = process.env.OUT_DIR || 'public/data', DEPTH = Number(process.env.DEPTH || 16), TMP = process.env.TMP_DIR || '/tmp/pgn';
// [id, zip, white, black, date prefix, event, round, signature moves the right game must contain]
const GAMES = [
 ['immortal', 'Anderssen', /anderssen/i, /kieseritzky/i, '1851', /immortal/i, null, []],
 ['evergreen', 'Anderssen', /anderssen/i, /dufresne/i, '1852', null, null, []],
 ['opera', 'Morphy', /morphy/i, /isouard/i, '1858', null, null, []],
 ['lasker-bauer', 'Lasker', /lasker/i, /bauer, johann/i, '1889', null, null, ['Bxh7+', 'Bxg7']],
 ['steinitz-bardeleben', 'Steinitz', /steinitz/i, /bardeleben/i, '1895', null, null, []],
 ['rotlewi-rubinstein', 'Rubinstein', /rotlewi/i, /rubinstein/i, '1907', null, null, ['Rxc3']],
 ['reti-tartakower', 'Reti', /reti/i, /tartakower/i, '1910', null, null, ['Bd8#']],
 ['marshall-levitsky', 'Marshall', /levitsky/i, /marshall/i, '1912', null, '6', []],
 ['capablanca-marshall', 'Capablanca', /capablanca/i, /marshall/i, '1918', null, null, []],
 ['botvinnik-capablanca', 'Botvinnik', /botvinnik/i, /capablanca/i, '1938', /avro/i, null, []],
 ['byrne-fischer', 'Fischer', /byrne/i, /fischer/i, '1956', null, null, []],
 ['spassky-bronstein', 'Spassky', /spassky/i, /bronstein/i, '1960', /urs-ch/i, null, []],
 ['tal-botvinnik-g6', 'Tal', /botvinnik/i, /tal/i, '1960', /world/i, '6', []],
 ['fischer-spassky-g6', 'Fischer', /fischer/i, /spassky/i, '1972', /world/i, '6', []],
 ['karpov-kasparov-g16', 'Karpov', /karpov/i, /kasparov/i, '1985', /world/i, '16', []],
 ['karpov-kasparov-g24', 'Karpov', /karpov/i, /kasparov/i, '1985', /world/i, '24', []],
 ['short-timman', 'Short', /short/i, /timman/i, '1991', /tilburg/i, '4', []],
 ['deep-blue-g6', 'Kasparov', /deep blue/i, /kasparov/i, '1997', null, '6', []],
 ['kasparov-topalov', 'Kasparov', /kasparov/i, /topalov/i, '1999.01', /hoogovens/i, '4', []],
 ['kasparov-world', 'Kasparov', /kasparov/i, /world/i, '1999', null, null, []],
 ['carlsen-nepo-g6', 'Carlsen', /carlsen/i, /nepomniachtchi/i, '2021.12', /wch|world/i, '6', []],
 ['ding-gukesh-g14', 'Gukesh', /ding/i, /gukesh/i, '2024.12', /wch/i, '14', []],
 // Magnus Carlsen and Hikaru Nakamura
 ['carlsen-ernst', 'Carlsen', /carlsen/i, /ernst/i, '2004.01', null, null, []],
 ['carlsen-kasparov-draw', 'Carlsen', /carlsen/i, /kasparov/i, '2004.03', /rapid/i, '1.1', []],
 ['carlsen-anand-g5', 'Carlsen', /carlsen/i, /anand/i, '2013.11', /wch 2013/i, '5', []],
 ['carlsen-karjakin-g10', 'Carlsen', /carlsen/i, /karjakin/i, '2016.11.24', /wch 2016/i, '10', []],
 ['carlsen-karjakin-tb4', 'Carlsen', /carlsen/i, /karjakin/i, '2016.11.30', /rapid tb/i, '4', []],
 ['carlsen-caruana-tb3', 'Carlsen', /carlsen/i, /caruana/i, '2018.11.28', /rapid tb/i, '3', []],
 ['carlsen-niemann-2022', 'Carlsen', /carlsen/i, /niemann/i, '2022.09.04', /sinquefield/i, '3', []],
 ['nakamura-carlsen-paris-2017', 'Nakamura', /nakamura/i, /carlsen/i, '2017.06.25', /paris/i, '17', []],
 ['nakamura-gukesh-candidates', 'Nakamura', /nakamura/i, /gukesh/i, '2024.04.21', /candidates/i, '14', []],
 ['nakamura-carlsen-armageddon-2024', 'Nakamura', /nakamura/i, /carlsen/i, '2024.06.03', /armageddon/i, '7', []],
];
// Online games from Chess.com: [id, username, archive month, game url]. Added after reviewing candidates with the engine.
const CHESSCOM = [
 ['gotham-hikaru-2019', 'GothamChess', '2019/03', 'https://www.chess.com/game/live/3525048050'],
 ['gotham-qxh7-2026', 'GothamChess', '2026/09', 'https://www.chess.com/game/live/184634890030'],
 ['gotham-bishop-check-2026', 'GothamChess', '2026/09', 'https://www.chess.com/game/live/174461400570'],
 ['botez-bishop-queen-checks-2021', 'AlexandraBotez', '2021/09', 'https://www.chess.com/game/live/26624404449'],
 ['botez-qe1-2026', 'AlexandraBotez', '2026/07', 'https://www.chess.com/game/live/172259101246'],
 ['botez-mate-in-48-2022', 'AlexandraBotez', '2022/04', 'https://www.chess.com/game/live/43198737083'],
];
const DISPLAY = { gothamchess: 'Levy Rozman (GothamChess)', alexandrabotez: 'Alexandra Botez', hikaru: 'Hikaru Nakamura', magnuscarlsen: 'Magnus Carlsen' };
fs.mkdirSync(TMP, { recursive: true });
const tag = (p, k) => (p.match(new RegExp(`\\[${k} "([^"]*)"\\]`)) || [])[1] || '';
const files = {};
async function load(player) {
 if (files[player]) return files[player]; const zip = `${TMP}/${player}.zip`;
 if (!fs.existsSync(zip)) { const r = await fetch(`https://www.pgnmentor.com/players/${player}.zip`, { headers: { 'User-Agent': 'chessito-classics/1.0 (personal project)' } }); if (!r.ok) throw new Error('download failed ' + player); fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer())); }
 return files[player] = execSync(`unzip -p ${zip}`, { maxBuffer: 1 << 28 }).toString('latin1').split(/\r?\n\r?\n(?=\[Event )/).map(s => s.trim()).filter(Boolean);
}
const sf = spawn(process.env.STOCKFISH || '/usr/games/stockfish'); let buf = '', waiter = null;
sf.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); waiter?.(l); } });
const send = s => sf.stdin.write(s + '\n'), until = p => new Promise(r => { const prev = waiter, acc = []; waiter = l => { acc.push(l); if (p(l)) { waiter = prev; r(acc); } }; });
send('uci'); await until(l => l === 'uciok'); send('setoption name Threads value ' + (process.env.THREADS || 4)); send('setoption name Hash value 256'); send('isready'); await until(l => l === 'readyok');
async function evaluate(fen) {
 send('position fen ' + fen); const p = until(l => l.startsWith('bestmove')); send('go depth ' + DEPTH);
 let cp = 0, mate = null; for (const l of await p) { const m = l.match(/\bscore (cp|mate) (-?\d+)/); if (m && !/bound/.test(l)) { if (m[1] === 'cp') { cp = +m[2]; mate = null; } else { mate = +m[2]; cp = mate > 0 ? 10000 : -10000; } } }
 const white = fen.split(' ')[1] === 'w'; const best = (await p).at(-1).split(' ')[1]; return { cp: cp * (white ? 1 : -1), mate: mate === null ? null : mate * (white ? 1 : -1), best: best === '(none)' ? '' : best };
}
const target = `${OUT}/classics.json`;
const existing = fs.existsSync(target) && !process.env.FORCE ? JSON.parse(fs.readFileSync(target, 'utf8')) : [];
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const out = existing.filter(g => !(only && only.has(g.id)));
const todo = id => (!only || only.has(id)) && !out.some(g => g.id === id);
async function analyze(meta, sans) {
 const c = new Chess(), fens = [c.fen()]; for (const s of sans) { c.move(s); fens.push(c.fen()); }
 const cp = [], mate = [], best = [];
 for (const f of fens) { const k = new Chess(f); if (k.isGameOver()) { const mated = k.isCheckmate(); cp.push(mated ? (k.turn() === 'w' ? -10000 : 10000) : 0); mate.push(mated ? 0 : null); best.push(''); continue; } const e = await evaluate(f); cp.push(e.cp); mate.push(e.mate); best.push(e.best); }
 out.push({ ...meta, depth: DEPTH, sans, cp, mate, best }); console.log(`${meta.id}: ${sans.length} plies done`);
}
const clean = s => String(s).replace(/\s+/g, ' ').replace(/^Duke Karl Count Isouard$/, 'Duke of Brunswick and Count Isouard').replace(/, +/g, ', ').trim();
for (const [id, zip, wRe, bRe, date, evRe, round, must] of GAMES) {
 if (!todo(id)) continue; let pick = null;
 for (const g of await load(zip)) {
  if (!tag(g, 'Date').startsWith(date) || !wRe.test(tag(g, 'White')) || !bRe.test(tag(g, 'Black'))) continue;
  if (evRe && !evRe.test(tag(g, 'Event'))) continue; if (round && tag(g, 'Round') !== round && tag(g, 'Round').split('.')[0] !== round) continue;
  const c = new Chess(); try { c.loadPgn(g); } catch { continue; } const sans = c.history(); if (must.some(m => !sans.includes(m))) continue;
  if (!pick || sans.length > pick.sans.length) pick = { g, sans };
 }
 if (!pick) { console.log('NOT FOUND', id); continue; }
 const { g, sans } = pick;
 await analyze({ id, source: 'mentor', white: clean(tag(g, 'White')), black: clean(tag(g, 'Black')), event: tag(g, 'Event'), site: tag(g, 'Site'), date: tag(g, 'Date'), result: tag(g, 'Result') }, sans);
}
const months = {};
async function chesscomGame(user, ym, url) {
 const key = `${user}/${ym}`; if (!months[key]) { const r = await fetch(`https://api.chess.com/pub/player/${user}/games/${ym}`, { headers: { 'User-Agent': 'chessito-classics/1.0 (personal project)' } }); if (!r.ok) throw new Error(`Chess.com ${r.status} for ${key}`); months[key] = await r.json(); }
 return months[key].games.find(g => g.url === url);
}
for (const [id, user, ym, url] of CHESSCOM) {
 if (!todo(id)) continue; const g = await chesscomGame(user, ym, url); if (!g) { console.log('NOT FOUND', id); continue; }
 const c = new Chess(); c.loadPgn(g.pgn); const name = side => DISPLAY[side.username.toLowerCase()] || `Opponent (${side.rating})`;  // other players' usernames are not republished
 const d = tag(g.pgn, 'Date'); const [base, inc] = String(g.time_control).split('+');
 await analyze({ id, source: 'chesscom', link: g.url, white: name(g.white), black: name(g.black), event: `Chess.com ${g.time_class} ${Math.round(Number(base) / 60 * 100) / 100}+${inc || 0}`, site: 'Chess.com', date: d, result: tag(g.pgn, 'Result') }, c.history());
}
sf.kill(); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(target, JSON.stringify(out)); console.log('wrote', out.length, 'games');
