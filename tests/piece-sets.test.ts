import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import sets from '../lib/piece-sets.json' with { type: 'json' };

test('every piece set has a complete, licensed folder of SVGs', () => {
 assert.equal(new Set(sets.map(s => s.id)).size, sets.length);
 assert.ok(sets.length >= 30);
 for (const s of sets) {
  assert.ok(s.label && s.author && s.license, s.id);
  assert.ok(['free', 'open', 'nc'].includes(s.group), s.id);
  if (s.id === 'classic') continue;
  for (const c of 'wb') for (const p of 'KQRBNP') {
   const f = `public/pieces/${s.id}/${c}${p}.svg`;
   assert.ok(existsSync(f), f);
   assert.ok(readFileSync(f, 'utf8').includes('<svg'), f);
  }
 }
});

test('non-commercial sets are flagged and permissive ones are not', () => {
 for (const s of sets) {
  if (/NC/.test(s.license)) assert.equal(s.group, 'nc', s.id);
  if (/^(CC0|CC BY 4|MIT|Apache)/.test(s.license)) assert.equal(s.group, 'free', s.id);
 }
});

test('credits file lists every set', () => {
 const credits = readFileSync('public/pieces/CREDITS.md', 'utf8');
 for (const s of sets) assert.ok(credits.includes(s.label), s.label);
});
