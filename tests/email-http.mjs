// Email flows against a running container with a fake Resend server. Usage:
//   node tests/email-http.mjs configured   (container: RESEND_API_KEY=test-resend-key CHESSITO_EMAIL_FROM='Chessito <chess@example.test>' RESEND_API_URL=http://127.0.0.1:3199, on :3100)
//   node tests/email-http.mjs nomail       (container without the Resend settings, on :3101)
import assert from 'node:assert/strict';
import http from 'node:http';
const mode = process.argv[2] || 'configured';
const origin = process.env.TEST_ORIGIN || (mode === 'nomail' ? 'http://127.0.0.1:3101' : 'http://127.0.0.1:3100');
const ownerName = 'test-owner', ownerPw = 'Chessito-local-test-credential-2026', run = Math.random().toString(36).slice(2, 6);

const raw = (path, { method = 'GET', cookie, body, json = false, headers = {} } = {}) => fetch(origin + path, { method, redirect: 'manual',
 headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' } : {}), ...headers },
 body: body ? (json ? JSON.stringify(body) : new URLSearchParams(body)) : undefined });
const api = async (path, o = {}) => { const r = await raw(path, { ...o, json: true }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
const login = async (u, p, extra = {}) => { const r = await raw('/login', { method: 'POST', body: { username: u, password: p, ...extra } }); return { r, cookie: cookieOf(r) }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (mode === 'nomail') {
 assert.doesNotMatch(await (await raw('/login')).text(), /Forgot your password/);
 const f = await (await raw('/forgot')).text(); assert.match(f, /not set up/); assert.doesNotMatch(f, /name="identifier"/);
 assert.match(await (await raw('/forgot', { method: 'POST', body: { identifier: ownerName } })).text(), /Check your email/, 'same answer either way');
 const o = await login(ownerName, ownerPw); assert.equal(o.r.status, 303);
 const me = await api('/account/me', { cookie: o.cookie }); assert.equal(me.body.email.configured, false);
 assert.equal((await api('/account/email', { method: 'POST', cookie: o.cookie, body: { email: 'a@example.test' } })).status, 400);
 const inv = await api('/account/invites', { method: 'POST', cookie: o.cookie, body: { email: 'friend@example.test' } });
 assert.equal(inv.status, 200); assert.equal(inv.body.emailed, false); assert.match(inv.body.emailError, /not set up/); assert.match(inv.body.url, /register\?invite=/);
 console.log('PASS email (not configured): features stay off, invites still give a link'); process.exit(0);
}

// ---- fake Resend ----
const sent = [];
const fake = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
 if (req.url !== '/emails' || req.method !== 'POST' || req.headers.authorization !== 'Bearer test-resend-key') { res.writeHead(401); res.end('{}'); return; }
 const m = JSON.parse(b); assert.ok(m.from && Array.isArray(m.to) && m.subject && m.html && m.text);
 if (m.to.includes('fail@example.test')) { res.writeHead(500); res.end('{"message":"boom"}'); return; }
 sent.push(m); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"id":"test"}'); }); });
await new Promise(r => fake.listen(3199, '127.0.0.1', r));
const to = addr => sent.filter(m => m.to[0] === addr);
const linkIn = (m, part) => (m.text.match(new RegExp(`https?://[^\\s]*${part}[^\\s]*`)) || [])[0];
const waitMail = async (addr, n) => { for (let i = 0; i < 30 && to(addr).length < n; i++) await sleep(100); return to(addr); };
const path = url => url.replace(origin, '');

try {
 // remember me and the forgot link are on the sign-in page
 const page = await (await raw('/login')).text();
 assert.match(page, /name="remember"/); assert.match(page, /Remember me on this device/); assert.match(page, /Forgot your password/);
 const keep = await login(ownerName, ownerPw, { remember: '1' }); assert.match(keep.r.headers.get('set-cookie'), /Max-Age=2592000/);
 const once = await login(ownerName, ownerPw); assert.doesNotMatch(once.r.headers.get('set-cookie'), /Max-Age/, 'not remembered: a browser-session cookie');
 assert.equal((await api('/account/me', { cookie: once.cookie })).status, 200);
 let o = keep;

 // the owner adds and confirms an address
 assert.deepEqual((await api('/account/me', { cookie: o.cookie })).body.email, { configured: true, address: null, verified: false });
 assert.equal((await api('/account/email', { method: 'POST', cookie: o.cookie, body: { email: 'not-an-email' } })).status, 400);
 assert.equal((await api('/account/email', { method: 'POST', cookie: o.cookie, body: { email: 'Owner@Example.test' } })).status, 200);
 const verifyMail = (await waitMail('owner@example.test', 1))[0]; assert.match(verifyMail.subject, /Confirm your email/);
 const confirmUrl = linkIn(verifyMail, 'confirm-email'); assert.ok(confirmUrl);
 assert.deepEqual((await api('/account/me', { cookie: o.cookie })).body.email, { configured: true, address: null, verified: false }, 'a pending address is not stored until confirmed');
 // an unconfirmed address is never used for resets
 await raw('/forgot', { method: 'POST', body: { identifier: 'owner@example.test' } }); await sleep(300);
 assert.equal(to('owner@example.test').length, 1, 'no reset email before the address is confirmed');
 // opening the link alone changes nothing (scanners follow links); the button confirms
 assert.match(await (await raw(path(confirmUrl))).text(), /Confirm email/);
 assert.equal((await api('/account/me', { cookie: o.cookie })).body.email.verified, false);
 const token = new URL(confirmUrl).searchParams.get('token');
 assert.match(await (await raw('/confirm-email', { method: 'POST', body: { token } })).text(), /Email confirmed/);
 assert.equal((await api('/account/me', { cookie: o.cookie })).body.email.verified, true);
 assert.match(await (await raw('/confirm-email', { method: 'POST', body: { token } })).text(), /does not work/, 'single use');

 // forgot password by username: same answer for real and unknown accounts, mail only for the real one
 const real = await (await raw('/forgot', { method: 'POST', body: { identifier: ownerName } })).text();
 const unknown = await (await raw('/forgot', { method: 'POST', body: { identifier: 'nobody' + run } })).text();
 assert.equal(real, unknown, 'the response does not reveal whether an account exists'); assert.match(real, /Check your email/);
 const resetMail = (await waitMail('owner@example.test', 2))[1]; assert.match(resetMail.subject, /Reset your Chessito password/);
 const resetUrl = linkIn(resetMail, '/reset'); assert.ok(resetUrl); const rtoken = new URL(resetUrl).searchParams.get('token');
 assert.equal(sent.length, 2, 'nothing was sent for the unknown account');
 // the reset page
 assert.match(await (await raw(path(resetUrl))).text(), /Choose a new password/);
 assert.match(await (await raw('/reset?token=bogus-bogus-bogus-bogus-bogus')).text(), /does not work/);
 assert.equal((await raw('/reset', { method: 'POST', body: { token: rtoken, password: 'short', confirm: 'short' } })).status, 400);
 assert.equal((await raw('/reset', { method: 'POST', body: { token: rtoken, password: 'owner-reset-password-1', confirm: 'owner-reset-password-2' } })).status, 400);
 assert.match(await (await raw(path(resetUrl))).text(), /Choose a new password/, 'a mistake does not burn the link');
 const done = await raw('/reset', { method: 'POST', body: { token: rtoken, password: 'owner-reset-password-1', confirm: 'owner-reset-password-1' } });
 assert.equal(done.status, 200); assert.match(await done.text(), /Password updated/);
 assert.equal((await api('/account/me', { cookie: o.cookie })).status, 401, 'every session was signed out');
 assert.equal((await login(ownerName, ownerPw)).r.status, 401); o = await login(ownerName, 'owner-reset-password-1'); assert.equal(o.r.status, 303);
 assert.match(await (await raw(path(resetUrl))).text(), /does not work/, 'a reset link works once');
 assert.equal((await raw('/reset', { method: 'POST', body: { token: rtoken, password: 'owner-reset-password-9', confirm: 'owner-reset-password-9' } })).status, 400);

 // invite by email
 assert.equal((await api('/account/invites', { method: 'POST', cookie: o.cookie, body: { email: 'bad address' } })).status, 400);
 const inv = await api('/account/invites', { method: 'POST', cookie: o.cookie, body: { email: 'Friend@Example.test', days: 3, uses: 10, note: 'Sam' } });
 assert.equal(inv.status, 200); assert.equal(inv.body.emailed, true); assert.equal(inv.body.email, 'friend@example.test');
 const invMail = (await waitMail('friend@example.test', 1))[0]; assert.match(invMail.subject, /invited you to Chessito/); assert.match(invMail.text, /3 days/);
 const regUrl = linkIn(invMail, 'register'); assert.equal(regUrl, inv.body.url);
 assert.match(await (await raw(path(regUrl))).text(), /friend@example\.test/, 'the invited address is shown');
 const code = new URL(regUrl).searchParams.get('invite'); const friend = 'friend' + run, fpw = 'a-long-friend-password-' + run;
 const reg = await raw('/register', { method: 'POST', body: { invite: code, username: friend, displayName: 'Sam', password: fpw, confirm: fpw } }); assert.equal(reg.status, 303);
 assert.deepEqual((await api('/account/me', { cookie: cookieOf(reg) })).body.email, { configured: true, address: 'friend@example.test', verified: true }, 'the invite confirmed their address');
 assert.equal((await raw('/register', { method: 'POST', body: { invite: code, username: 'other' + run, password: fpw, confirm: fpw } })).status, 400, 'an invite sent to one address is single-use');
 // that friend can reset by email address straight away
 await raw('/forgot', { method: 'POST', body: { identifier: 'FRIEND@example.test' } });
 const fReset = (await waitMail('friend@example.test', 2))[1]; assert.ok(fReset, 'reset mail by address');
 const ft = new URL(linkIn(fReset, '/reset')).searchParams.get('token'); const fnew = 'friend-new-password-' + run;
 assert.equal((await raw('/reset', { method: 'POST', body: { token: ft, password: fnew, confirm: fnew } })).status, 200);
 assert.equal((await login(friend, fpw)).r.status, 401); assert.equal((await login(friend, fnew)).r.status, 303);
 const people = (await api('/account/members', { cookie: o.cookie })).body.members; assert.equal(people.find(m => m.username === friend).email, 'friend@example.test');

 // a provider failure does not break the invite
 const failing = await api('/account/invites', { method: 'POST', cookie: o.cookie, body: { email: 'fail@example.test' } });
 assert.equal(failing.status, 200); assert.equal(failing.body.emailed, false); assert.match(failing.body.emailError, /could not be sent/); assert.match(failing.body.url, /register\?invite=/);
 assert.equal((await api('/account/invites', { method: 'POST', cookie: o.cookie, body: { days: 1 } })).body.emailed, false, 'a plain invite link still works');

 // limits: confirmation mails (3/hour per person), then reset requests (5/hour per visitor address)
 for (let i = 0; i < 2; i++) assert.equal((await api('/account/email', { method: 'POST', cookie: o.cookie, body: { email: `extra${i}${run}@example.test` } })).status, 200);
 assert.equal((await api('/account/email', { method: 'POST', cookie: o.cookie, body: { email: 'extra9@example.test' } })).status, 429);
 let before = sent.length;
 for (let i = 0; i < 4; i++) await raw('/forgot', { method: 'POST', body: { identifier: ownerName } });   // earlier requests already used some of the 5
 await sleep(500); const after = sent.length;
 assert.ok(after - before < 4, 'reset emails stop once the address is over its limit');
 const limited = await (await raw('/forgot', { method: 'POST', body: { identifier: friend } })).text(); assert.match(limited, /Check your email/, 'still the same answer when limited');
 console.log('PASS email: remember me, confirmation, reset (single-use, safe on mistakes), no account enumeration, invites by email, failures handled, limits');
} finally { fake.close(); }
