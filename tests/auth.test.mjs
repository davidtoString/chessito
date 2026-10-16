import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initializeDatabase } from '../docker/database.mjs';
import * as auth from '../docker/auth.mjs';

function setup() {
 const dir = mkdtempSync(path.join(tmpdir(), 'chessito-auth-'));
 const db = initializeDatabase(dir, path.resolve('drizzle'));
 return { db, done: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test('usernames and passwords are validated', () => {
 assert.equal(auth.validateUsername('alice_01'), '');
 assert.notEqual(auth.validateUsername('al'), '');
 assert.notEqual(auth.validateUsername('has space'), '');
 assert.notEqual(auth.validateUsername('admin'), '');
 assert.equal(auth.normalizeUsername('  Alice '), 'alice');
 assert.notEqual(auth.validatePassword('short', 'alice'), '');
 assert.notEqual(auth.validatePassword('xxalicexx1234', 'alice'), '');
 assert.notEqual(auth.validatePassword('password123', 'bob'), '');
 assert.equal(auth.validatePassword('a-good-long-passphrase', 'alice'), '');
 assert.equal(auth.cleanDisplayName('  <b>Al</b>  ', 'x'), 'bAl/b');
 assert.equal(auth.cleanDisplayName('', 'fallback'), 'fallback');
});

test('passwords hash with scrypt, verify, and never match a wrong value', async () => {
 const h = await auth.hashPassword('correct horse battery');
 assert.match(h, /^scrypt\$32768\$8\$1\$/);
 assert.equal(await auth.verifyPassword('correct horse battery', h), true);
 assert.equal(await auth.verifyPassword('wrong horse battery', h), false);
 assert.equal(await auth.verifyPassword('x', 'garbage'), false);
 assert.notEqual(h, await auth.hashPassword('correct horse battery'));
});

test('the owner is created once and keeps the old user id', async () => {
 const { db, done } = setup();
 try {
  assert.equal(await auth.bootstrapOwner(db, 'David', 'a-long-owner-password'), true);
  assert.equal(await auth.bootstrapOwner(db, 'Other', 'another-long-password'), false);
  const owner = await auth.authenticate(db, 'DAVID', 'a-long-owner-password');
  assert.equal(owner.id, auth.OWNER_ID); assert.equal(owner.role, 'owner');
  assert.equal(await auth.authenticate(db, 'david', 'wrong-password-here'), null);
  assert.equal(await auth.authenticate(db, 'nobody', 'a-long-owner-password'), null);
 } finally { done(); }
});

test('invites: single use, expiry, revocation, and a taken username does not burn the invite', async () => {
 const { db, done } = setup();
 try {
  await auth.bootstrapOwner(db, 'david', 'a-long-owner-password');
  const inv = auth.createInvite(db, { createdBy: auth.OWNER_ID, days: 7, uses: 1, note: 'for Sam' });
  assert.equal(auth.inviteValid(db, inv.code), true);
  assert.equal(auth.inviteValid(db, 'nope'), false);
  const taken = await auth.register(db, { code: inv.code, username: 'david', password: 'a-long-friend-password' });
  assert.match(taken.error, /taken/);
  assert.equal(auth.inviteValid(db, inv.code), true, 'invite survives a failed registration');
  const weak = await auth.register(db, { code: inv.code, username: 'sam', password: 'short' });
  assert.ok(weak.error); assert.equal(auth.inviteValid(db, inv.code), true);
  const ok = await auth.register(db, { code: inv.code, username: 'Sam', displayName: 'Sam K', password: 'a-long-friend-password' });
  assert.ok(ok.user.last_login_at, 'a new member counts as signed in'); assert.equal(ok.user.username, 'sam'); assert.equal(ok.user.display_name, 'Sam K'); assert.equal(ok.user.role, 'member');
  assert.equal(auth.inviteValid(db, inv.code), false, 'single-use invite is spent');
  assert.match((await auth.register(db, { code: inv.code, username: 'sam2', password: 'a-long-friend-password' })).error, /invalid|used up/);
  const multi = auth.createInvite(db, { createdBy: auth.OWNER_ID, uses: 2 });
  assert.ok((await auth.register(db, { code: multi.code, username: 'ann', password: 'a-long-friend-password' })).user);
  assert.ok((await auth.register(db, { code: multi.code, username: 'ben', password: 'a-long-friend-password' })).user);
  assert.ok((await auth.register(db, { code: multi.code, username: 'cat', password: 'a-long-friend-password' })).error);
  const rev = auth.createInvite(db, { createdBy: auth.OWNER_ID });
  assert.equal(auth.revokeInvite(db, rev.id), true); assert.equal(auth.inviteValid(db, rev.code), false);
  db.prepare('UPDATE invites SET expires_at=? WHERE id=?').run(Date.now() - 1, auth.createInvite(db, { createdBy: auth.OWNER_ID }).id);
  assert.equal(auth.listInvites(db).length, 0, 'spent, revoked and expired invites are not listed');
 } finally { done(); }
});

test('sessions are server-side and revocable', async () => {
 const { db, done } = setup();
 try {
  await auth.bootstrapOwner(db, 'david', 'a-long-owner-password');
  const t1 = auth.createSession(db, auth.OWNER_ID, 'agent'), t2 = auth.createSession(db, auth.OWNER_ID);
  assert.equal(auth.sessionUser(db, t1).id, auth.OWNER_ID);
  assert.equal(auth.sessionUser(db, 'x'.repeat(30)), null);
  assert.equal(auth.sessionUser(db, undefined), null);
  auth.revokeSession(db, t1); assert.equal(auth.sessionUser(db, t1), null); assert.ok(auth.sessionUser(db, t2));
  const t3 = auth.createSession(db, auth.OWNER_ID); auth.revokeSessions(db, auth.OWNER_ID, t3);
  assert.equal(auth.sessionUser(db, t2), null); assert.ok(auth.sessionUser(db, t3));
  db.prepare('UPDATE sessions SET expires_at=?').run(Date.now() - 1); assert.equal(auth.sessionUser(db, t3), null);
  auth.pruneSessions(db); assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
 } finally { done(); }
});

test('changing a password checks the old one and signs out other devices; resetting works', async () => {
 const { db, done } = setup();
 try {
  await auth.bootstrapOwner(db, 'david', 'a-long-owner-password');
  const keep = auth.createSession(db, auth.OWNER_ID), other = auth.createSession(db, auth.OWNER_ID);
  assert.match(await auth.changePassword(db, auth.OWNER_ID, 'wrong-current-pw', 'a-brand-new-password', keep), /current password/);
  assert.match(await auth.changePassword(db, auth.OWNER_ID, 'a-long-owner-password', 'short', keep), /at least 10/);
  assert.equal(await auth.changePassword(db, auth.OWNER_ID, 'a-long-owner-password', 'a-brand-new-password', keep), '');
  assert.ok(auth.sessionUser(db, keep)); assert.equal(auth.sessionUser(db, other), null);
  assert.equal(await auth.authenticate(db, 'david', 'a-long-owner-password'), null);
  assert.ok(await auth.authenticate(db, 'david', 'a-brand-new-password'));
  assert.equal(await auth.resetPassword(db, 'david', 'reset-by-the-cli-1234'), true);
  assert.equal(auth.sessionUser(db, keep), null);
  assert.ok(await auth.authenticate(db, 'david', 'reset-by-the-cli-1234'));
  assert.equal(await auth.resetPassword(db, 'ghost', 'reset-by-the-cli-1234'), false);
 } finally { done(); }
});

test('disabling blocks login and sessions; deleting removes the member and all their data; the owner is protected', async () => {
 const { db, done } = setup();
 try {
  await auth.bootstrapOwner(db, 'david', 'a-long-owner-password');
  const inv = auth.createInvite(db, { createdBy: auth.OWNER_ID });
  const sam = (await auth.register(db, { code: inv.code, username: 'sam', password: 'a-long-friend-password' })).user;
  db.prepare("INSERT INTO games (user_id,id,data,updated_at) VALUES (?,?,?,?)").run(sam.id, 'g1', '{}', 'x');
  db.prepare("INSERT INTO games (user_id,id,data,updated_at) VALUES (?,?,?,?)").run(auth.OWNER_ID, 'g1', '{}', 'x');
  db.prepare("INSERT INTO preferences (user_id,data,encrypted_key) VALUES (?,?,?)").run(sam.id, '{}', null);
  const tok = auth.createSession(db, sam.id);
  assert.equal(auth.setDisabled(db, sam.id, true), true);
  assert.equal(auth.sessionUser(db, tok), null);
  assert.equal(await auth.authenticate(db, 'sam', 'a-long-friend-password'), null);
  assert.equal(auth.setDisabled(db, sam.id, false), true);
  assert.ok(await auth.authenticate(db, 'sam', 'a-long-friend-password'));
  assert.equal(auth.listUsers(db).find(u => u.username === 'sam').games, 1);
  assert.equal(auth.setDisabled(db, auth.OWNER_ID, true), false);
  assert.equal(auth.deleteUser(db, auth.OWNER_ID), false);
  assert.equal(auth.deleteUser(db, sam.id), true);
  assert.equal(db.prepare('SELECT count(*) AS n FROM games WHERE user_id=?').get(sam.id).n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM preferences WHERE user_id=?').get(sam.id).n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM games WHERE user_id=?').get(auth.OWNER_ID).n, 1, "the owner's games are untouched");
  assert.equal(auth.getUser(db, sam.id), undefined);
 } finally { done(); }
});

test('throttle locks after repeated failures, backs off, and resets', () => {
 const t = new auth.Throttle({ max: 3, windowMs: 60000, baseLockMs: 1000, maxLockMs: 4000 });
 for (let i = 0; i < 2; i++) t.fail('k'); assert.equal(t.wait('k'), 0);
 t.fail('k'); assert.ok(t.wait('k') >= 1); assert.equal(t.wait('other'), 0);
 t.reset('k'); assert.equal(t.wait('k'), 0);
});

test('remember me controls how long a session lasts', async () => {
 const { db, done } = setup();
 try {
  await auth.bootstrapOwner(db, 'david', 'a-long-owner-password');
  const long = auth.createSession(db, auth.OWNER_ID, 'ua', true), short = auth.createSession(db, auth.OWNER_ID, 'ua', false);
  const rows = db.prepare('SELECT token_hash, expires_at FROM sessions ORDER BY expires_at').all();
  const span = ms => ms - Date.now();
  assert.ok(span(rows[0].expires_at) <= auth.SHORT_SESSION_MS && span(rows[0].expires_at) > auth.SHORT_SESSION_MS - 5000);
  assert.ok(span(rows[1].expires_at) > auth.SESSION_MS - 5000);
  assert.ok(auth.sessionUser(db, long) && auth.sessionUser(db, short));
 } finally { done(); }
});

test('email addresses are validated and normalized', () => {
 assert.equal(auth.normalizeEmail('  Sam@Example.COM '), 'sam@example.com');
 for (const ok of ['a@b.co', 'first.last+tag@sub.example.org']) assert.equal(auth.validEmail(ok), true, ok);
 for (const bad of ['', 'nope', 'a@b', 'a b@c.com', 'a@b.c', '<x>@y.com', 'a@b.com,c@d.com']) assert.equal(auth.validEmail(bad), false, bad);
});

test('an address is only used after its owner confirms it, and a link works once', async () => {
 const { db, done } = setup();
 try {
  await auth.bootstrapOwner(db, 'david', 'a-long-owner-password');
  const owner = auth.getUser(db, auth.OWNER_ID);
  assert.equal(auth.userByLogin(db, 'david'), null, 'no address yet: nothing can be sent');
  assert.ok(auth.startEmailChange(db, owner, 'nope').error);
  const { token } = auth.startEmailChange(db, owner, 'Owner@Example.com');
  assert.equal(auth.userByLogin(db, 'owner@example.com'), null, 'unconfirmed address is not used');
  assert.equal(auth.confirmEmail(db, 'x'.repeat(30)), null);
  assert.equal(auth.confirmEmail(db, token).email, 'owner@example.com');
  assert.equal(auth.confirmEmail(db, token), null, 'a confirmation link is single-use');
  assert.equal(auth.userByLogin(db, 'DAVID').id, auth.OWNER_ID);
  assert.equal(auth.userByLogin(db, ' Owner@example.com ').id, auth.OWNER_ID);
  assert.equal(auth.userByLogin(db, 'someone@else.com'), null);
 } finally { done(); }
});

test('password reset: weak passwords keep the link, success signs everyone out, the link is single-use, newest wins', async () => {
 const { db, done } = setup();
 try {
  await auth.bootstrapOwner(db, 'david', 'a-long-owner-password');
  db.prepare("UPDATE users SET email='owner@example.com', email_verified=1 WHERE id=?").run(auth.OWNER_ID);
  const user = auth.userByLogin(db, 'david');
  const first = auth.startReset(db, user), second = auth.startReset(db, user);
  assert.match((await auth.completeReset(db, first, 'a-brand-new-password')).error, /invalid or has expired/, 'only the newest link works');
  const session = auth.createSession(db, auth.OWNER_ID);
  assert.ok((await auth.completeReset(db, second, 'short')).error, 'weak password refused');
  assert.ok(auth.peekToken(db, second, 'reset'), 'the link survives a weak password');
  const ok = await auth.completeReset(db, second, 'a-brand-new-password');
  assert.equal(ok.user.id, auth.OWNER_ID);
  assert.equal(auth.sessionUser(db, session), null, 'sessions are revoked');
  assert.ok(await auth.authenticate(db, 'david', 'a-brand-new-password'));
  assert.equal(await auth.authenticate(db, 'david', 'a-long-owner-password'), null);
  assert.ok((await auth.completeReset(db, second, 'yet-another-password')).error, 'single use');
  const expired = auth.startReset(db, user); db.prepare('UPDATE email_tokens SET expires_at=?').run(Date.now() - 1);
  assert.ok((await auth.completeReset(db, expired, 'yet-another-password')).error, 'expired');
  const forConfirm = auth.createEmailToken(db, { userId: auth.OWNER_ID, purpose: 'verify', email: 'x@example.com', ttlMs: 60000 });
  assert.ok((await auth.completeReset(db, forConfirm, 'yet-another-password')).error, 'a confirmation token cannot reset a password');
  db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(auth.OWNER_ID);
  assert.equal(auth.userByLogin(db, 'david'), null, 'disabled accounts get no reset email');
 } finally { done(); }
});

test('an invite sent to an address confirms that address for the new member', async () => {
 const { db, done } = setup();
 try {
  await auth.bootstrapOwner(db, 'david', 'a-long-owner-password');
  const inv = auth.createInvite(db, { createdBy: auth.OWNER_ID, email: ' Friend@Example.com ' });
  assert.equal(auth.inviteEmail(db, inv.code), 'friend@example.com');
  assert.equal(auth.listInvites(db)[0].email, 'friend@example.com');
  const sam = (await auth.register(db, { code: inv.code, username: 'sam', password: 'a-long-friend-password' })).user;
  assert.equal(sam.email, 'friend@example.com'); assert.equal(sam.email_verified, 1);
  assert.equal(auth.userByLogin(db, 'friend@example.com').id, sam.id, 'they can reset by address straight away');
  // a second invite to the same address does not create a duplicate address
  const again = auth.createInvite(db, { createdBy: auth.OWNER_ID, email: 'friend@example.com' });
  const ann = (await auth.register(db, { code: again.code, username: 'ann', password: 'a-long-friend-password' })).user;
  assert.equal(ann.email, null);
  assert.equal(auth.inviteEmail(db, auth.createInvite(db, { createdBy: auth.OWNER_ID, email: 'garbage' }).code), null);
  assert.equal(auth.listUsers(db).find(u => u.username === 'sam').email, 'friend@example.com');
 } finally { done(); }
});
