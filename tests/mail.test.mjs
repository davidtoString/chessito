import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mailConfig, sendMail, inviteEmail, resetEmail, verifyEmail } from '../docker/mail.mjs';

test('mail is off without both settings', () => {
 assert.equal(mailConfig({}), null);
 assert.equal(mailConfig({ RESEND_API_KEY: 'k' }), null);
 assert.equal(mailConfig({ CHESSITO_EMAIL_FROM: 'a@b.c' }), null);
 assert.deepEqual(mailConfig({ RESEND_API_KEY: 'k', CHESSITO_EMAIL_FROM: 'C <a@b.c>', RESEND_API_URL: 'http://x/' }), { key: 'k', from: 'C <a@b.c>', api: 'http://x' });
});
test('sendMail posts the Resend payload and never leaks the key', async () => {
 let seen;
 const srv = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { seen = { url: req.url, auth: req.headers.authorization, body: JSON.parse(b) }; res.writeHead(JSON.parse(b).to[0] === 'bad@x.com' ? 500 : 200); res.end('{"id":"1"}'); }); });
 await new Promise(r => srv.listen(0, '127.0.0.1', r)); const api = `http://127.0.0.1:${srv.address().port}`;
 const cfg = { key: 'secret-key', from: 'Chessito <c@x.com>', api };
 await sendMail(cfg, { to: 'a@x.com', subject: 'S', html: '<b>h</b>', text: 't' });
 assert.equal(seen.url, '/emails'); assert.equal(seen.auth, 'Bearer secret-key');
 assert.deepEqual(seen.body, { from: 'Chessito <c@x.com>', to: ['a@x.com'], subject: 'S', html: '<b>h</b>', text: 't' });
 await assert.rejects(sendMail(cfg, { to: 'bad@x.com', subject: 'S', html: 'h', text: 't' }), e => /HTTP 500/.test(e.message) && !e.message.includes('secret-key'));
 srv.close();
});
test('templates carry the link and escape names', () => {
 const url = 'https://chess.example/reset?token=abc';
 for (const m of [inviteEmail({ inviter: '<b>Dave</b>', url, days: 7 }), resetEmail({ name: '<i>Sam</i>', url }), verifyEmail({ name: 'Sam', url })]) {
  assert.ok(m.subject && m.text.includes(url) && m.html.includes(url));
  assert.ok(!m.html.includes('<b>Dave</b>') && !m.html.includes('<i>Sam</i>'), 'names are escaped in HTML');
 }
 assert.match(inviteEmail({ inviter: 'Dave', url, days: 1 }).text, /1 day\./);
});
