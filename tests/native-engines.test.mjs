import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { makePosition } from '../engines/uci.mjs';
test('UCI input preserves full game history and rejects injection',()=>{
 const c=new Chess();const initial=c.fen();const moves=[];for(const san of ['e4','a6','e5','d5','exd6']){const m=c.move(san);moves.push(m.from+m.to+(m.promotion||''));}
 const result=makePosition({fen:c.fen(),startFen:initial,moves,level:0});assert.match(result.command,/moves e2e4 a7a6 e4e5 d7d5 e5d6$/);
 assert.throws(()=>makePosition({fen:c.fen()+'\nquit',level:0}));
 assert.throws(()=>makePosition({fen:c.fen(),startFen:initial,moves:['e2e5'],level:0}));
 assert.throws(()=>makePosition({fen:c.fen(),level:9}));
 assert.throws(()=>makePosition({fen:initial,startFen:initial,moves,level:0}));
});
