import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createBackup } from '../docker/backup.mjs';

test('online backup includes committed WAL data, matching key and valid checksums', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'chessito-backup-'));
  const db = new DatabaseSync(path.join(root, 'chessito.sqlite'));
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE games(id TEXT);');
    db.prepare('INSERT INTO games VALUES (?)').run('committed-in-wal');
    writeFileSync(path.join(root, 'encryption-key'), 'a'.repeat(64), { mode: 0o600 });
    const { folder } = await createBackup(root);
    const snapshot = new DatabaseSync(path.join(folder, 'chessito.sqlite'), { readOnly: true });
    try { assert.equal(snapshot.prepare('SELECT id FROM games').get().id, 'committed-in-wal'); } finally { snapshot.close(); }
    assert.equal(readFileSync(path.join(folder, 'encryption-key'), 'utf8'), 'a'.repeat(64));
    for (const line of readFileSync(path.join(folder, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
      const [hash, name] = line.split('  ');
      assert.equal(hash, createHash('sha256').update(readFileSync(path.join(folder, name))).digest('hex'));
    }
    db.prepare('INSERT INTO games VALUES (?)').run('after-backup');
    assert.equal(db.prepare('SELECT count(*) AS count FROM games').get().count, 2);
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});

test('backup refuses a missing database or invalid key without creating an empty database', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'chessito-backup-invalid-'));
  try {
    writeFileSync(path.join(root, 'encryption-key'), 'invalid');
    await assert.rejects(createBackup(root), /Invalid encryption key/);
    writeFileSync(path.join(root, 'encryption-key'), 'b'.repeat(64));
    await assert.rejects(createBackup(root));
    assert.equal(existsSync(path.join(root, 'chessito.sqlite')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
