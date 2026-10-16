// Owner tools, run inside the container:  docker compose exec chessito node docker/users.mjs <command>
//   list                        show accounts
//   reset-password <username>   set a new random password (printed once) and sign that user out everywhere
//   invite [days] [uses]        print an invite link
//   test-email <address>        send a test message through Resend to check the settings
import { randomBytes } from 'node:crypto';
import { initializeDatabase } from './database.mjs';
import * as auth from './auth.mjs';
import { mailConfig, sendMail, testEmail } from './mail.mjs';
const [cmd, a, b] = process.argv.slice(2);
const db = initializeDatabase();
try {
 if (cmd === 'list') for (const u of auth.listUsers(db)) console.log(`${u.username.padEnd(20)} ${u.role.padEnd(7)} ${u.disabled ? 'disabled' : 'active  '} games=${u.games} last login=${u.lastLoginAt ?? 'never'}`);
 else if (cmd === 'reset-password' && a) {
  const pw = randomBytes(15).toString('base64url');
  if (await auth.resetPassword(db, a, pw)) console.log(`New password for ${auth.normalizeUsername(a)}: ${pw}\nThey are signed out everywhere. Ask them to change it in Settings.`);
  else { console.error('No such user.'); process.exitCode = 1; }
 } else if (cmd === 'invite') {
  const owner = db.prepare("SELECT id FROM users WHERE role='owner'").get();
  const inv = auth.createInvite(db, { createdBy: owner.id, days: Number(a) || 7, uses: Number(b) || 1, note: 'created from the command line' });
  const origin = process.env.CHESSITO_PUBLIC_ORIGIN || 'http://localhost:3000';
  console.log(`${origin}/register?invite=${inv.code}`);
 } else if (cmd === 'test-email' && a) {
  const cfg = mailConfig();
  if (!cfg) { console.error('Email is off: set RESEND_API_KEY and CHESSITO_EMAIL_FROM in .env, then recreate the container.'); process.exitCode = 1; }
  else try { await sendMail(cfg, { to: a, ...testEmail() }); console.log(`Sent a test message to ${a} from ${cfg.from}.`); } catch (e) { console.error(`Could not send: ${e.message}. Check the API key, and that the sender domain is verified in Resend.`); process.exitCode = 1; }
 } else { console.error('Usage: node docker/users.mjs list | reset-password <username> | invite [days] [uses] | test-email <address>'); process.exitCode = 1; }
} finally { db.close(); }
