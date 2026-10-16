import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { soundSets, fileFor, defaultSoundSet, type Kind } from '../lib/sound.ts';

test('every recorded set has the files its events need', () => {
 assert.ok(soundSets.some(s => s.id === defaultSoundSet));
 assert.equal(new Set(soundSets.map(s => s.id)).size, soundSets.length);
 for (const s of soundSets) {
  assert.ok(s.label && s.author && s.license, s.id);
  if (!s.samples) continue;
  for (const k of Object.keys(fileFor) as Kind[]) {
   if (k === 'castle' && !s.castles) continue;
   const f = `public/sounds/${s.id}/${fileFor[k]}.mp3`;
   assert.ok(existsSync(f), f);
   assert.ok(readFileSync(f).length > 1500, f + ' looks too small to be audio');
  }
 }
});

test('non-commercial sets are flagged and credited', () => {
 const credits = readFileSync('public/sounds/CREDITS.md', 'utf8');
 for (const s of soundSets.filter(x => x.samples)) assert.ok(credits.includes(s.label), s.label);
 for (const s of soundSets) if (/NC/.test(s.license)) assert.equal(s.group, 'nc');
});
