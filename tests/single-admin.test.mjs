// Database rules: only the owner account can hold an admin role, and there is only one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const db = new DatabaseSync(':memory:');
for (const f of readdirSync('drizzle').filter(n => n.endsWith('.sql')).sort()) db.exec(readFileSync('drizzle/' + f, 'utf8'));
const add = (id, role) => db.prepare('INSERT INTO users (id,username,display_name,password_hash,role,disabled,created_at) VALUES (?,?,?,?,?,0,?)').run(id, id, id, 'x', role, 'now');

test('the owner can be created, members are plain members, and nobody else can be admin', () => {
 add('docker-owner', 'owner'); add('m1', 'member'); add('m2', 'member');
 assert.throws(() => add('m3', 'owner'), /admin rights|UNIQUE/);
 assert.throws(() => add('m4', 'admin'), /admin rights/);
 assert.throws(() => db.prepare("UPDATE users SET role='owner' WHERE id='m1'").run(), /admin rights|UNIQUE/);
 assert.throws(() => db.prepare("UPDATE users SET role='admin' WHERE id='m2'").run(), /admin rights/);
 assert.throws(() => db.prepare("UPDATE users SET role='member' WHERE id='docker-owner'").run(), /admin rights/);
 assert.throws(() => db.prepare("UPDATE users SET id='someone' WHERE id='docker-owner'").run(), /admin rights/);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role<>'member'").get().n, 1);
 db.prepare("UPDATE users SET display_name='Changed' WHERE id='docker-owner'").run();   // ordinary edits still work
});
