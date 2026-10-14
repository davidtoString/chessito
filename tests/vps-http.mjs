import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';

// Runs in a disposable proxy-network client against an isolated deployment.
const settings = Object.fromEntries(readFileSync(process.env.TEST_ENV_FILE || '/checks/.env', 'utf8').trim().split('\n').map(line => {
  const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
}));
const origin = 'https://' + settings.CHESSITO_DOMAIN;
const target = 'http://' + settings.CHESSITO_PROXY_ALIAS + ':3000';
const headers = { Host: settings.CHESSITO_DOMAIN, Origin: origin, 'Content-Type': 'application/json',
  Authorization: 'Basic ' + Buffer.from(settings.CHESSITO_USERNAME + ':' + settings.CHESSITO_PASSWORD).toString('base64') };
// Use HTTP directly to model a reverse proxy preserving the public Host header.
const request = (url, options = {}) => new Promise((resolve, reject) => {
  const req = http.request(target + url, { method: options.method || 'GET', headers: { ...headers, ...options.headers } }, res => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
    res.on('error', reject);
  });
  req.setTimeout(60000, () => req.destroy(new Error('VPS test request timed out')));
  req.on('error', reject); req.end(options.body?.toString());
});

assert.equal((await request('/healthz')).status, 200);
assert.equal((await request('/api/health', { headers: { Authorization: '' } })).status, 401);
assert.equal((await request('/api/data', { headers: { Authorization: '' } })).status, 401);
assert.equal((await request('/', { headers: { Host: 'wrong.example' } })).status, 421);
const login = await request('/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ username: settings.CHESSITO_USERNAME, password: settings.CHESSITO_PASSWORD }) });
assert.equal(login.status, 303);
assert.match(login.headers.get('set-cookie'), /; Secure/);
assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
assert.match(login.headers.get('strict-transport-security'), /max-age=/);
const home = await request('/');
assert.equal(home.status, 200);
assert.match(await home.text(), /Play Pip/);
assert.match(home.headers.get('content-security-policy'), /nonce-/);
assert.equal((await request('/api/data', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' })).status, 403);
const engines = await request('/api/engines');
assert.equal(engines.status, 200);
const catalog = (await engines.json()).engines;
assert.equal(catalog.length, 4);
const legalReplies = new Set(['a7a5','a7a6','b7b5','b7b6','c7c5','c7c6','d7d5','d7d6','e7e5','e7e6','f7f5','f7f6','g7g5','g7g6','h7h5','h7h6','b8a6','b8c6','g8f6','g8h6']);
for (const engine of catalog) {
  assert.equal(engine.available, true, engine.name);
  const reply = await request('/api/engines/move', { method: 'POST', body: JSON.stringify({ engine: engine.id, level: 0,
    startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: ['e2e4'],
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' }) });
  assert.equal(reply.status, 200);
  assert.ok(legalReplies.has((await reply.json()).move), engine.name + ' legal opening reply');
}
const id = 'vps-test-' + crypto.randomUUID();
try {
  const save = await request('/api/data', { method: 'POST', body: JSON.stringify({ type: 'game', game: {
    id, title: 'VPS proxy test', pgn: '1. e4 e5 *', result: '*', createdAt: new Date().toISOString(),
    source: 'played', color: 'w', bot: 0, engine: 'stockfish', review: [], revision: 0
  } }) });
  assert.equal(save.status, 200);
  const library = await (await request('/api/data')).json();
  assert.ok(library.games.some(game => game.id === id));
  await assert.rejects(fetch('http://engines:8000/healthz', { signal: AbortSignal.timeout(3000) }), 'Engine hostname must not be accessible on the proxy network.');
  console.log('PASS VPS proxy routing, HTTPS cookies, private API, Host/Origin guards, database, engine discovery and engine network isolation.');
} finally { await request('/api/data', { method: 'DELETE', body: JSON.stringify({ id }) }); }
