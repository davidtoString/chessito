import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const checker = fileURLToPath(new URL('../scripts/check-repository.mjs', import.meta.url));
function fixture(run) {
  const root = mkdtempSync(path.join(tmpdir(), 'chessito-repository-'));
  try {
    const init = spawnSync('git', ['init', '--quiet'], { cwd: root });
    assert.equal(init.status, 0);
    return run(root, () => spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' }));
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('repository check accepts source, credential examples and binary engine assets', () => fixture((root, check) => {
  writeFileSync(path.join(root, 'app.ts'), 'export const ready = true;');
  writeFileSync(path.join(root, '.env.example'), 'CHESSITO_PASSWORD=GENERATE_A_PASSWORD_LOCALLY');
  writeFileSync(path.join(root, 'engine.wasm'), Buffer.from([0, 97, 115, 109]));
  assert.equal(check().status, 0);
}));

test('repository check rejects tracked caches and private data even if ignored', () => fixture((root, check) => {
  writeFileSync(path.join(root, '.gitignore'), '*.tsbuildinfo\ndata/');
  writeFileSync(path.join(root, 'tsconfig.tsbuildinfo'), '{}');
  mkdirSync(path.join(root, 'data'));
  writeFileSync(path.join(root, 'data', 'chessito.sqlite'), 'private database');
  assert.equal(spawnSync('git', ['add', '-f', 'tsconfig.tsbuildinfo', 'data/chessito.sqlite'], { cwd: root }).status, 0);
  const result = check(); assert.equal(result.status, 1);
  assert.match(result.stderr, /tsconfig\.tsbuildinfo/);
  assert.match(result.stderr, /data\/chessito\.sqlite/);
}));

test('repository check rejects credentials in examples without printing their value', () => fixture((root, check) => {
  const fakeToken = 'AIza' + 'a'.repeat(35);
  writeFileSync(path.join(root, '.env.example'), 'PROVIDER_KEY=' + fakeToken);
  const result = check(); assert.equal(result.status, 1);
  assert.match(result.stderr, /possible credential/);
  assert.ok(!result.stderr.includes(fakeToken));
}));
