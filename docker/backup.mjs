import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function createBackup(dataRoot, backupRoot = path.join(dataRoot, 'backups')) {
  const key = readFileSync(path.join(dataRoot, 'encryption-key'));
  if (!/^[a-f0-9]{64}$/.test(key.toString().trim())) throw new Error('Invalid encryption key; backup stopped.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = path.join(backupRoot, stamp);
  mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  mkdirSync(folder, { mode: 0o700 });
  const db = new DatabaseSync(path.join(dataRoot, 'chessito.sqlite'), { readOnly: true });
  try {
    await backup(db, path.join(folder, 'chessito.sqlite'));
    chmodSync(path.join(folder, 'chessito.sqlite'), 0o600);
    const copy = new DatabaseSync(path.join(folder, 'chessito.sqlite'), { readOnly: true });
    try {
      if (copy.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Backup database integrity check failed.');
    } finally { copy.close(); }
    writeFileSync(path.join(folder, 'encryption-key'), key, { mode: 0o600, flag: 'wx' });
    const checksums = ['chessito.sqlite', 'encryption-key'].map(name =>
      createHash('sha256').update(readFileSync(path.join(folder, name))).digest('hex') + '  ' + name
    ).join('\n') + '\n';
    // A backup is complete only after this manifest has been written.
    writeFileSync(path.join(folder, 'SHA256SUMS'), checksums, { mode: 0o600, flag: 'wx' });
    return { folder, stamp };
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { folder, stamp } = await createBackup(process.env.CHESSITO_DATA_DIR || '/data');
  console.log(process.argv.includes('--print-name') ? stamp : 'Backup saved: ' + folder);
}
