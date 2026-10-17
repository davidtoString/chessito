// Integration test for accounts against a running container (default http://127.0.0.1:3100).
// Start one with: docker run -d -p 127.0.0.1:3100:3000 -e CHESSITO_USERNAME=test-owner -e CHESSITO_PASSWORD=Chessito-local-test-credential-2026 -e CHESSITO_PUBLIC_ORIGIN=http://127.0.0.1:3100 <image>
import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:3100';
const ownerName = process.env.TEST_USERNAME || 'test-owner', ownerPw = process.env.TEST_PASSWORD || 'Chessito-local-test-credential-2026';
const run = Math.random().toString(36).slice(2, 7);
const friend = 'friend' + run, friendPw = 'a-long-friend-password-' + run, newPw = 'another-long-password-' + run;

const raw = (path, { method = 'GET', cookie, body, headers = {}, json = false, noOrigin = false } = {}) => fetch(origin + path, {
 method, redirect: 'manual',
 headers: { ...(noOrigin ? {} : { Origin: origin }), ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' } : {}), ...headers },
 body: body ? (json ? JSON.stringify(body) : new URLSearchParams(body)) : undefined,
});
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
const login = async (username, password) => { const r = await raw('/login', { method: 'POST', body: { username, password } }); return { r, cookie: cookieOf(r) }; };
const api = async (path, opts = {}) => { const r = await raw(path, { ...opts, json: true }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const game = (id, title) => ({ type: 'game', game: { id, title, pgn: '1. e4 e5 *', createdAt: new Date().toISOString(), source: 'played', color: 'w', bot: 0, engine: 'stockfish', review: [], result: '*', revision: 0 } });

// 1. nothing is visible without signing in
assert.equal((await raw('/api/data')).status, 401);
assert.equal((await raw('/account/me')).status, 401);
const home = await raw('/'); assert.equal(home.status, 303); assert.equal(home.headers.get('location'), '/login');
const loginHtml = await (await raw('/login')).text(); assert.match(loginHtml, /name="username"/); assert.match(loginHtml, /name="password"/);
assert.match(await (await raw('/register')).text(), /does not work/);
assert.match(await (await raw('/register?invite=not-a-real-invite')).text(), /does not work/);
assert.equal((await raw('/register', { method: 'POST', body: { invite: 'nope', username: 'x' + run, password: 'a-long-friend-password', confirm: 'a-long-friend-password' } })).status, 400);

// 2. the owner signs in (the account created from .env) and holds the old single-user data id
const o = await login(ownerName, ownerPw); assert.equal(o.r.status, 303);
assert.match(o.r.headers.get('set-cookie'), /HttpOnly/); assert.match(o.r.headers.get('set-cookie'), /SameSite=Lax/);
// Coming back to the login page (back button, old bookmark) while signed in goes to the app instead of showing the form.
const again = await raw('/login', { cookie: o.cookie }); assert.equal(again.status, 303); assert.equal(again.headers.get('location'), '/');
const me = await api('/account/me', { cookie: o.cookie }); assert.equal(me.body.role, 'owner'); assert.equal(me.body.id, 'docker-owner'); assert.equal(me.body.signup, 'invite');
assert.equal((await api('/api/data?view=library', { headers: { Authorization: 'Basic ' + Buffer.from(ownerName + ':' + ownerPw).toString('base64') } })).status, 200, 'Basic auth still works for scripts');
assert.equal((await login(ownerName, 'wrong-password-here')).r.status, 401);

// 3. the owner invites a friend
const inv = await api('/account/invites', { method: 'POST', cookie: o.cookie, body: { days: 7, uses: 1, note: 'test friend' } });
assert.equal(inv.status, 200); assert.match(inv.body.url, new RegExp('^' + origin + '/register\\?invite='));
const code = new URL(inv.body.url).searchParams.get('invite');
assert.match(await (await raw('/register?invite=' + code)).text(), /Create account/);
const noMatch = await raw('/register', { method: 'POST', body: { invite: code, username: friend, password: friendPw, confirm: friendPw + 'x' } }); assert.equal(noMatch.status, 400);
const weak = await raw('/register', { method: 'POST', body: { invite: code, username: friend, password: 'short', confirm: 'short' } }); assert.equal(weak.status, 400);
const taken = await raw('/register', { method: 'POST', body: { invite: code, username: ownerName, password: friendPw, confirm: friendPw } }); assert.equal(taken.status, 400);
const reg = await raw('/register', { method: 'POST', body: { invite: code, username: friend.toUpperCase(), displayName: 'Fri End', password: friendPw, confirm: friendPw } });
assert.equal(reg.status, 303, 'registration succeeds and signs in'); const fc = cookieOf(reg);
const fme = await api('/account/me', { cookie: fc }); assert.equal(fme.body.username, friend); assert.equal(fme.body.displayName, 'Fri End'); assert.equal(fme.body.role, 'member'); assert.notEqual(fme.body.id, 'docker-owner');
assert.equal((await raw('/register', { method: 'POST', body: { invite: code, username: 'other' + run, password: friendPw, confirm: friendPw } })).status, 400, 'a single-use invite cannot be reused');

// 4. isolation: the same game id belongs to two different people
const gid = 'shared-id-' + run;
assert.equal((await api('/api/data', { method: 'POST', cookie: o.cookie, body: game(gid, 'Owner game') })).status, 200);
assert.equal((await api('/api/data?view=library', { cookie: fc })).body.total, 0, 'the friend sees none of the owner games');
assert.equal((await api('/api/data?id=' + gid, { cookie: fc })).status, 404, 'the friend cannot open the owner game by id');
assert.equal((await api('/api/data', { method: 'POST', cookie: fc, body: game(gid, 'Friend game') })).status, 200, 'no id collision across accounts');
assert.equal((await api('/api/data?id=' + gid, { cookie: o.cookie })).body.game.title, 'Owner game');
assert.equal((await api('/api/data?id=' + gid, { cookie: fc })).body.game.title, 'Friend game');
assert.equal((await api('/api/data', { method: 'POST', cookie: fc, body: { type: 'settings', settings: { provider: 'none', model: '', autoCoach: true } } })).status, 200);
assert.equal((await api('/api/data?view=library', { cookie: o.cookie })).body.settings.autoCoach, false, 'settings are per account');
const spoof = await api('/api/data?view=library', { cookie: fc, headers: { 'oai-authenticated-user-id': 'docker-owner', 'oai-authenticated-user-email': 'owner@chessito.local' } });
assert.ok(!spoof.body.games.some(g => g.title === 'Owner game'), 'a client cannot spoof the identity header');
assert.equal((await api('/api/data', { method: 'DELETE', cookie: fc, body: { id: gid } })).status, 200);
assert.equal((await api('/api/data?id=' + gid, { cookie: o.cookie })).body.game.title, 'Owner game', "deleting the friend's game leaves the owner's");
assert.equal((await api('/api/data', { method: 'POST', cookie: fc, body: game(gid, 'Friend game again') })).status, 200);

// 5. permissions
assert.equal((await api('/account/invites', { method: 'POST', cookie: fc, body: {} })).status, 403);
assert.equal((await api('/account/members', { cookie: fc })).status, 403);
assert.equal((await api('/account/members', { method: 'POST', cookie: fc, body: { id: 'docker-owner', action: 'disable' } })).status, 403);
const members = (await api('/account/members', { cookie: o.cookie })).body.members; assert.equal(members.length, 2);
assert.equal(members.find(m => m.username === friend).games, 1);
const friendId = members.find(m => m.username === friend).id;
assert.equal((await api('/account/members', { method: 'POST', cookie: o.cookie, body: { id: 'docker-owner', action: 'disable' } })).status, 400, 'the owner cannot be disabled');
assert.equal((await api('/account/delete', { method: 'POST', cookie: o.cookie, body: { password: ownerPw } })).status, 400, 'the owner cannot be deleted');

// 6. origin protection on account changes
assert.equal((await api('/account/password', { method: 'POST', cookie: fc, body: { current: friendPw, next: newPw }, headers: { Origin: 'https://evil.example' } })).status, 403);
assert.equal((await api('/account/password', { method: 'POST', cookie: fc, body: { current: friendPw, next: newPw }, noOrigin: true })).status, 403);

// 7. password change keeps this device, drops the others, and takes effect
const second = (await login(friend, friendPw)).cookie; assert.equal((await api('/account/me', { cookie: second })).status, 200);
assert.equal((await api('/account/password', { method: 'POST', cookie: fc, body: { current: 'wrong-current-pw', next: newPw } })).status, 400);
assert.equal((await api('/account/password', { method: 'POST', cookie: fc, body: { current: friendPw, next: 'short' } })).status, 400);
assert.equal((await api('/account/password', { method: 'POST', cookie: fc, body: { current: friendPw, next: newPw } })).status, 200);
assert.equal((await api('/account/me', { cookie: fc })).status, 200, 'this device stays signed in');
assert.equal((await api('/account/me', { cookie: second })).status, 401, 'other devices are signed out');
assert.equal((await login(friend, friendPw)).r.status, 401); const f2 = await login(friend, newPw); assert.equal(f2.r.status, 303);

// 8. sign out everywhere else
const f3 = (await login(friend, newPw)).cookie;
assert.equal((await api('/account/signout-all', { method: 'POST', cookie: f2.cookie, body: {} })).status, 200);
assert.equal((await api('/account/me', { cookie: f3 })).status, 401); assert.equal((await api('/account/me', { cookie: f2.cookie })).status, 200);

// 9. logout really ends the session server-side
const tmp = (await login(friend, newPw)).cookie; const out = await raw('/logout', { method: 'POST', cookie: tmp });
assert.equal(out.status, 303); assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
assert.equal((await api('/account/me', { cookie: tmp })).status, 401, 'the old cookie no longer works even if kept');

// 10. disabling and enabling
assert.equal((await api('/account/members', { method: 'POST', cookie: o.cookie, body: { id: friendId, action: 'disable' } })).status, 200);
assert.equal((await api('/account/me', { cookie: f2.cookie })).status, 401); assert.equal((await login(friend, newPw)).r.status, 401);
assert.equal((await api('/account/members', { method: 'POST', cookie: o.cookie, body: { id: friendId, action: 'enable' } })).status, 200);
const f4 = await login(friend, newPw); assert.equal(f4.r.status, 303);

// 11. rate limiting: five wrong passwords lock that username (known or not), without locking anyone else
const ghost = 'ghost' + run; let last;
for (let i = 0; i < 6; i++) last = await login(ghost, 'wrong-password-' + i);
assert.equal(last.r.status, 429, 'locked after repeated failures'); assert.ok(Number(last.r.headers.get('retry-after')) >= 1);
assert.equal((await login(ownerName, ownerPw)).r.status, 303, 'other accounts are not affected');

// 12. revoked invites stop working
const inv2 = (await api('/account/invites', { method: 'POST', cookie: o.cookie, body: { days: 1, uses: 5 } })).body;
const listed = (await api('/account/invites', { cookie: o.cookie })).body.invites; assert.ok(listed.length >= 1);
assert.equal((await api('/account/invites/revoke', { method: 'POST', cookie: o.cookie, body: { id: inv2.id } })).status, 200);
assert.match(await (await raw('/register?invite=' + new URL(inv2.url).searchParams.get('invite'))).text(), /does not work/);

// 13. deleting an account removes the person and their data, and only theirs
assert.equal((await api('/account/delete', { method: 'POST', cookie: f4.cookie, body: { password: 'not-my-password' } })).status, 400);
const del = await api('/account/delete', { method: 'POST', cookie: f4.cookie, body: { password: newPw } }); assert.equal(del.status, 200);
assert.equal((await api('/account/me', { cookie: f4.cookie })).status, 401); assert.equal((await login(friend, newPw)).r.status, 401);
assert.equal((await api('/account/members', { cookie: o.cookie })).body.members.length, 1);
assert.equal((await api('/api/data?id=' + gid, { cookie: o.cookie })).body.game.title, 'Owner game', "the owner's data survived");
await api('/api/data', { method: 'DELETE', cookie: o.cookie, body: { id: gid } });
console.log('PASS accounts: invites, registration, isolation, spoofed headers, permissions, origin checks, password change, sign-out, disable, throttling, delete');
