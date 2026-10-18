// Library filters against a running container (default http://127.0.0.1:3100): result, month, sort, opponent.
import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:3100';
const headers = { 'Content-Type': 'application/json', Origin: origin, Authorization: 'Basic ' + Buffer.from(`${process.env.TEST_USERNAME || 'test-owner'}:${process.env.TEST_PASSWORD || 'Chessito-local-test-credential-2026'}`).toString('base64') };
const post = async b => { const r = await fetch(origin + '/api/data', { method: 'POST', headers, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };
const get = async q => (await fetch(origin + '/api/data' + q, { headers })).json();
const run = Math.random().toString(36).slice(2, 6);
assert.equal((await post({ type: 'profile', usernames: ['hero'] })).status, 200);
const pgn = (date, res) => `[Event "t"]\n[Date "${date}"]\n[Result "${res}"]\n\n1. e4 e5 ${res}`;
const g = (id, title, source, color, bot, result, date) => ({ id: `${id}-${run}`, title, source, color, bot, result, engine: 'stockfish', review: [], revision: 0, pgn: pgn(date, result), createdAt: date.replace(/\./g, '-') + 'T10:00:00Z' });
const games = [
 g('p1', 'You vs. Pip', 'played', 'w', 0, '1-0', '2026.10.03'), g('p2', 'You vs. Pip', 'played', 'w', 0, '0-1', '2026.10.02'),
 g('p3', 'You vs. Clover', 'played', 'w', 1, '0-1', '2026.09.20'), g('p4', 'You vs. Scout', 'played', 'b', 2, '0-1', '2026.09.11'),
 g('p5', 'You vs. Atlas', 'played', 'w', 3, '1/2-1/2', '2026.08.22'), g('p6', 'You vs. Atlas', 'played', 'w', 3, '*', '2026.08.20'),
 g('i1', 'hero vs. rival', 'imported', 'w', 0, '0-1', '2026.09.14'), g('i2', 'rival vs. hero', 'imported', 'w', 0, '0-1', '2026.07.10'),
];
for (const x of games) assert.equal((await post({ type: 'game', game: x })).status, 200, x.id);
const ids = async q => (await get('?view=library' + q)).games.map(x => x.id.replace('-' + run, '')).sort();

assert.equal((await get('?view=library')).total, 8);
assert.deepEqual(await ids('&source=played'), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], 'bots only');
assert.deepEqual(await ids('&source=imported'), ['i1', 'i2']);
assert.deepEqual(await ids('&source=played&bot=0'), ['p1', 'p2'], 'one bot');
assert.deepEqual(await ids('&source=played&bot=3'), ['p5', 'p6']);
assert.deepEqual(await ids('&bot=2'), ['p4'], 'a bot filter implies games against bots');
assert.deepEqual(await ids('&bot=1&source=imported'), [], 'imported games never match a bot');
assert.deepEqual(await ids('&source=played&outcome=lost'), ['p2', 'p3'], 'bots + losses');
assert.deepEqual(await ids('&source=played&outcome=won'), ['p1', 'p4'], 'a win as Black counts');
assert.deepEqual(await ids('&source=imported&outcome=lost'), ['i1'], 'imported results use your username');
assert.deepEqual(await ids('&source=imported&outcome=won'), ['i2']);
assert.deepEqual(await ids('&source=played&month=2026.09'), ['p3', 'p4'], 'bots + month');
assert.deepEqual(await ids('&bot=0&outcome=won'), ['p1']);
const counts = (await get('?view=library&source=played')).outcomes; assert.deepEqual(counts, { won: 2, lost: 2, drawn: 1, unfinished: 1 }, 'result counts follow the opponent filter');
assert.deepEqual((await get('?view=library&source=imported')).outcomes, { lost: 1, won: 1 });
assert.deepEqual((await get('?view=months&source=played')).months, [{ month: '2026.10', count: 2 }, { month: '2026.09', count: 2 }, { month: '2026.08', count: 2 }], 'months follow the opponent filter');
assert.deepEqual((await get('?view=months&source=imported')).months, [{ month: '2026.09', count: 1 }, { month: '2026.07', count: 1 }]);
const newest = (await get('?view=library&source=played&order=newest')).games.map(x => x.gameDate); assert.deepEqual(newest, [...newest].sort().reverse(), 'sorted by month, newest first');
// junk values are ignored, never an error or injection
assert.equal((await get("?view=library&source=played'--&bot=123")).total, 8);
assert.equal((await get('?view=library&bot=abc')).total, 8);
for (const x of games) await fetch(origin + '/api/data', { method: 'DELETE', headers, body: JSON.stringify({ id: x.id }) });
console.log('PASS library: bots only, one bot, imported, combined with result, month and sort; counts and months follow the opponent filter');
