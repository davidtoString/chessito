// Accounts for the Docker gateway: scrypt password hashes, server-side sessions, invite links, rate limiting.
// Everything takes the SQLite handle as an argument so it can be tested against a temporary database.
import { scrypt, randomBytes, createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
const scryptAsync = promisify(scrypt);
const N = 32768, R = 8, P = 1, KEYLEN = 64, MAXMEM = 128 * 1024 * 1024;
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;        // "remember me"
export const SHORT_SESSION_MS = 12 * 60 * 60 * 1000;       // browser-session login
export const OWNER_ID = 'docker-owner';   // the user_id existing single-user data already belongs to

export const normalizeUsername = u => String(u ?? '').trim().normalize('NFC').toLowerCase();
const RESERVED = new Set(['admin', 'administrator', 'owner', 'root', 'system', 'chessito', 'support', 'staff', 'moderator']);
export function validateUsername(u) {
 if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(u)) return 'Use 3–32 letters, digits, dots, underscores or hyphens, starting with a letter or digit.';
 if (RESERVED.has(u)) return 'That username is reserved.';
 return '';
}
const COMMON = new Set(['password', 'password1', 'password12', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'chessito123', 'chesschess', 'letmein123', 'iloveyou123', 'abcdefghij']);
export function validatePassword(p, username = '') {
 if (typeof p !== 'string' || p.length < 10) return 'Use a password of at least 10 characters.';
 if (p.length > 200) return 'That password is too long.';
 if (username.length >= 4 && p.toLowerCase().includes(username)) return 'Your password should not contain your username.';
 if (COMMON.has(p.toLowerCase())) return 'That password is too common. Choose another.';
 return '';
}
export const cleanDisplayName = (name, fallback) => { const n = String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40); return n || fallback; };

// ── passwords ──────────────────────────────────────────────────────────────
export async function hashPassword(password) {
 const salt = randomBytes(16);
 const key = await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
 return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(password, stored) {
 const [kind, n, r, p, salt, hash] = String(stored).split('$');
 if (kind !== 'scrypt' || !hash) return false;
 try {
  const want = Buffer.from(hash, 'base64');
  const got = await scryptAsync(password, Buffer.from(salt, 'base64'), want.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return got.length === want.length && timingSafeEqual(got, want);
 } catch { return false; }
}
let dummy; // so an unknown username costs the same time as a wrong password
export async function burnTime(password) { dummy ||= await hashPassword('not-a-real-password'); await verifyPassword(password, dummy); }

// ── users ──────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
// The owner (david) is the only administrator. Everyone else is a member, whatever the database says.
export const isOwner = u => !!u && u.id === OWNER_ID && u.role === 'owner';
export const publicUser = u => u && ({ id: u.id, username: u.username, displayName: u.display_name, role: u.role });
export function userCount(db) { return db.prepare('SELECT count(*) AS n FROM users').get().n; }
export function getUser(db, id) { return db.prepare('SELECT * FROM users WHERE id=?').get(id); }

// Creates the owner on first start from the credentials in .env; existing games stay theirs.
export async function bootstrapOwner(db, username, password) {
 if (userCount(db) > 0) return false;
 const name = normalizeUsername(username);
 db.prepare('INSERT INTO users (id,username,display_name,password_hash,role,disabled,created_at) VALUES (?,?,?,?,?,0,?)')
  .run(OWNER_ID, name, String(username), await hashPassword(password), 'owner', now());
 return true;
}
export async function authenticate(db, username, password) {
 const u = db.prepare('SELECT * FROM users WHERE username=?').get(normalizeUsername(username));
 if (!u) { await burnTime(String(password)); return null; }
 const ok = await verifyPassword(String(password), u.password_hash);
 if (!ok || u.disabled) return null;
 db.prepare('UPDATE users SET last_login_at=? WHERE id=?').run(now(), u.id);
 return u;
}
export async function changePassword(db, userId, current, next, keepToken) {
 const u = getUser(db, userId); if (!u) return 'Account not found.';
 if (!(await verifyPassword(String(current), u.password_hash))) return 'Your current password is not correct.';
 const bad = validatePassword(next, u.username); if (bad) return bad;
 db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await hashPassword(next), userId);
 revokeSessions(db, userId, keepToken);
 return '';
}
export async function resetPassword(db, username, password) {
 const u = db.prepare('SELECT * FROM users WHERE username=?').get(normalizeUsername(username)); if (!u) return false;
 db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await hashPassword(password), u.id); revokeSessions(db, u.id); return true;
}
export function listUsers(db) {
 return db.prepare(`SELECT id,username,display_name AS displayName,role,disabled,created_at AS createdAt,last_login_at AS lastLoginAt,
  CASE WHEN email_verified=1 THEN email END AS email,(SELECT count(*) FROM games g WHERE g.user_id=users.id) AS games FROM users ORDER BY created_at`).all().map(u => ({ ...u, disabled: !!u.disabled }));
}
export function setDisabled(db, id, disabled) {
 const u = getUser(db, id); if (!u || u.role === 'owner') return false;
 db.prepare('UPDATE users SET disabled=? WHERE id=?').run(disabled ? 1 : 0, id); if (disabled) revokeSessions(db, id); return true;
}
// Removes the account and everything it owns. The owner account cannot be removed.
export function deleteUser(db, id) {
 const u = getUser(db, id); if (!u || u.role === 'owner') return false;
 db.exec('BEGIN IMMEDIATE');
 try { for (const t of ['games', 'preferences', 'practice_attempts', 'sessions']) db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(id); db.prepare('DELETE FROM invites WHERE created_by=?').run(id); db.prepare('DELETE FROM users WHERE id=?').run(id); db.exec('COMMIT'); }
 catch (e) { db.exec('ROLLBACK'); throw e; }
 return true;
}

// ── sessions ───────────────────────────────────────────────────────────────
const sha = s => createHash('sha256').update(s).digest('hex');
export function createSession(db, userId, userAgent = '', remember = true) {
 const token = randomBytes(32).toString('base64url');
 db.prepare('INSERT INTO sessions (token_hash,user_id,created_at,expires_at,user_agent) VALUES (?,?,?,?,?)').run(sha(token), userId, now(), Date.now() + (remember ? SESSION_MS : SHORT_SESSION_MS), String(userAgent).slice(0, 200));
 return token;
}
export function sessionUser(db, token) {
 if (!token || !/^[\w-]{20,80}$/.test(token)) return null;
 return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0').get(sha(token), Date.now()) ?? null;
}
export function revokeSession(db, token) { if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(token)); }
export function revokeSessions(db, userId, exceptToken) {
 if (exceptToken) db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(userId, sha(exceptToken));
 else db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
}
export function pruneSessions(db) { db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now()); db.prepare('DELETE FROM invites WHERE expires_at<=? AND uses>=max_uses').run(Date.now() - 30 * 86400000); }

// ── invites ────────────────────────────────────────────────────────────────
export function createInvite(db, { createdBy, days = 7, uses = 1, note = '', email = '' }) {
 const code = randomBytes(16).toString('base64url');
 const id = randomUUID();
 const mail = normalizeEmail(email);
 db.prepare('INSERT INTO invites (id,code_hash,created_by,note,created_at,expires_at,max_uses,uses,revoked,email) VALUES (?,?,?,?,?,?,?,0,0,?)')
  .run(id, sha(code), createdBy, String(note).replace(/[\u0000-\u001f<>]/g, '').slice(0, 60), now(), Date.now() + Math.min(Math.max(days, 1), 60) * 86400000, Math.min(Math.max(uses, 1), 50), mail && validEmail(mail) ? mail : null);
 return { id, code };
}
export function listInvites(db) {
 return db.prepare('SELECT id,note,email,created_at AS createdAt,expires_at AS expiresAt,max_uses AS maxUses,uses,revoked FROM invites WHERE revoked=0 AND expires_at>? AND uses<max_uses ORDER BY created_at DESC').all(Date.now());
}
export function revokeInvite(db, id) { return db.prepare('UPDATE invites SET revoked=1 WHERE id=?').run(id).changes === 1; }
export function inviteValid(db, code) {
 return !!code && !!db.prepare('SELECT 1 FROM invites WHERE code_hash=? AND revoked=0 AND uses<max_uses AND expires_at>?').get(sha(String(code)), Date.now());
}
// Uses up one invite and creates the account in one transaction, so a taken username does not burn the invite.
export async function register(db, { code, username, displayName, password }) {
 const name = normalizeUsername(username);
 const bad = validateUsername(name) || validatePassword(password, name); if (bad) return { error: bad };
 const hash = await hashPassword(password);
 db.exec('BEGIN IMMEDIATE');
 try {
  const used = db.prepare('UPDATE invites SET uses=uses+1 WHERE code_hash=? AND revoked=0 AND uses<max_uses AND expires_at>?').run(sha(String(code ?? '')), Date.now());
  if (used.changes !== 1) { db.exec('ROLLBACK'); return { error: 'That invite link is invalid, used up or expired. Ask your friend for a new one.' }; }
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(name)) { db.exec('ROLLBACK'); return { error: 'That username is taken. Choose another.' }; }
  const id = randomUUID();
  // An invite sent to an address proves that address (the link only reached its owner), unless another account already has it.
  const bound = db.prepare('SELECT email FROM invites WHERE code_hash=?').get(sha(String(code ?? '')))?.email;
  const email = bound && !db.prepare('SELECT 1 FROM users WHERE email=?').get(bound) ? bound : null;
  db.prepare('INSERT INTO users (id,username,display_name,password_hash,role,disabled,created_at,last_login_at,email,email_verified) VALUES (?,?,?,?,?,0,?,?,?,?)').run(id, name, cleanDisplayName(displayName, name), hash, 'member', now(), now(), email, email ? 1 : 0);
  db.exec('COMMIT'); return { user: getUser(db, id) };
 } catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
}

// ── rate limiting ──────────────────────────────────────────────────────────
// Counts failures per key; after `max` within the window the key is locked, for longer each time.
export class Throttle {
 constructor({ max = 5, windowMs = 60000, baseLockMs = 30000, maxLockMs = 15 * 60000 } = {}) { Object.assign(this, { max, windowMs, baseLockMs, maxLockMs }); this.m = new Map(); }
 wait(key) { const e = this.m.get(key); return e && e.lockedUntil > Date.now() ? Math.ceil((e.lockedUntil - Date.now()) / 1000) : 0; }
 fail(key) {
  if (this.m.size >= 5000 && !this.m.has(key)) this.m.delete(this.m.keys().next().value);
  const t = Date.now(); const e = this.m.get(key) ?? { count: 0, first: t, strikes: 0, lockedUntil: 0 };
  if (t - e.first > this.windowMs) { e.count = 0; e.first = t; }
  if (++e.count >= this.max) { e.strikes++; e.lockedUntil = t + Math.min(this.maxLockMs, this.baseLockMs * 2 ** (e.strikes - 1)); e.count = 0; e.first = t; }
  this.m.set(key, e);
 }
 reset(key) { this.m.delete(key); }
 sweep() { const t = Date.now(); for (const [k, e] of this.m) if (e.lockedUntil < t && t - e.first > this.windowMs * 10) this.m.delete(k); }
}

// ── email: validation, one-time tokens, confirmation and password reset ────
export const normalizeEmail = e => String(e ?? '').trim().toLowerCase();
export const validEmail = e => e.length <= 254 && /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[^\s@<>"',;]{2,}$/.test(e);
export const RESET_MS = 60 * 60 * 1000, VERIFY_MS = 24 * 60 * 60 * 1000;

export function createEmailToken(db, { userId, purpose, email, ttlMs }) {
 const token = randomBytes(32).toString('base64url');
 if (purpose === 'reset') db.prepare("DELETE FROM email_tokens WHERE user_id=? AND purpose='reset'").run(userId);   // only the newest reset link works
 db.prepare('INSERT INTO email_tokens (token_hash,user_id,purpose,email,created_at,expires_at,used) VALUES (?,?,?,?,?,?,0)').run(sha(token), userId, purpose, email, now(), Date.now() + ttlMs);
 return token;
}
const okToken = t => !!t && /^[\w-]{20,80}$/.test(t);
export function peekToken(db, token, purpose) {
 if (!okToken(token)) return null;
 return db.prepare('SELECT * FROM email_tokens WHERE token_hash=? AND purpose=? AND used=0 AND expires_at>?').get(sha(token), purpose, Date.now()) ?? null;
}
function takeToken(db, token, purpose) {   // single use, even if two requests race
 if (!okToken(token)) return null;
 db.exec('BEGIN IMMEDIATE');
 try {
  const row = db.prepare('SELECT * FROM email_tokens WHERE token_hash=? AND purpose=? AND used=0 AND expires_at>?').get(sha(token), purpose, Date.now());
  if (row) db.prepare('UPDATE email_tokens SET used=1 WHERE token_hash=?').run(row.token_hash);
  db.exec('COMMIT'); return row ?? null;
 } catch (e) { db.exec('ROLLBACK'); throw e; }
}
// Step 1 of adding an address: returns a token to email to that address. Nothing changes until the link is opened.
export function startEmailChange(db, user, email) {
 const mail = normalizeEmail(email);
 if (!validEmail(mail)) return { error: 'Enter a valid email address.' };
 if (db.prepare('SELECT 1 FROM users WHERE email=? AND id<>?').get(mail, user.id)) return { error: 'That email address cannot be used.' };
 return { token: createEmailToken(db, { userId: user.id, purpose: 'verify', email: mail, ttlMs: VERIFY_MS }), email: mail };
}
export function confirmEmail(db, token) {
 const row = takeToken(db, token, 'verify'); if (!row) return null;
 try { db.prepare('UPDATE users SET email=?,email_verified=1 WHERE id=?').run(row.email, row.user_id); } catch { return null; }
 return getUser(db, row.user_id) ?? null;
}
// People can reset by username or by address, but only an address they confirmed receives anything.
export function userByLogin(db, identifier) {
 const id = normalizeEmail(identifier); if (!id) return null;
 const u = db.prepare('SELECT * FROM users WHERE username=? OR (email=? AND email_verified=1)').get(id, id);
 return u && u.email && u.email_verified && !u.disabled ? u : null;
}
export function startReset(db, user) { return createEmailToken(db, { userId: user.id, purpose: 'reset', email: user.email, ttlMs: RESET_MS }); }
export async function completeReset(db, token, password) {
 const row = peekToken(db, token, 'reset'); if (!row) return { error: 'This reset link is invalid or has expired. Request a new one.' };
 const user = getUser(db, row.user_id); if (!user || user.disabled) return { error: 'This reset link is invalid or has expired. Request a new one.' };
 const bad = validatePassword(password, user.username); if (bad) return { error: bad };   // a weak password does not burn the link
 const hash = await hashPassword(password);
 if (!takeToken(db, token, 'reset')) return { error: 'This reset link is invalid or has expired. Request a new one.' };
 db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id);
 revokeSessions(db, user.id);
 db.prepare("DELETE FROM email_tokens WHERE user_id=? AND purpose='reset'").run(user.id);
 return { user };
}
export function inviteEmail(db, code) { return db.prepare('SELECT email FROM invites WHERE code_hash=?').get(sha(String(code ?? '')))?.email ?? null; }
export function pruneTokens(db) { db.prepare('DELETE FROM email_tokens WHERE expires_at<=? OR used=1').run(Date.now() - 86400000); }
