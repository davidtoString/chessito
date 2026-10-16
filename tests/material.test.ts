import test from 'node:test';
import assert from 'node:assert/strict';
import { material } from '../lib/material.ts';
import { soundFor } from '../lib/sound.ts';

test('material is level at the start', () => {
 const m = material('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
 assert.equal(m.diff, 0);
 assert.deepEqual(m.capturedBy.w, []);
 assert.deepEqual(m.capturedBy.b, []);
});

test('material reports captured pieces and the lead', () => {
 // Black has lost its queen and a pawn; White has lost a knight.
 const m = material('rnb1kbnr/ppp1pppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1');
 assert.deepEqual(m.capturedBy.w, ['q', 'p']);
 assert.deepEqual(m.capturedBy.b, ['n']);
 assert.equal(m.diff, 7);
});

test('soundFor picks the right sound', () => {
 assert.equal(soundFor({ san: 'e4', flags: 'b' }, false), 'move');
 assert.equal(soundFor({ san: 'Nxe5', flags: 'c', captured: 'p' }, false), 'capture');
 assert.equal(soundFor({ san: 'O-O', flags: 'k' }, false), 'castle');
 assert.equal(soundFor({ san: 'Qh5+', flags: 'n' }, false), 'check');
 assert.equal(soundFor({ san: 'Qxf7#', flags: 'c', captured: 'p' }, true), 'end');
});
