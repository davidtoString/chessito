import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {puzzles,scenarios,themes,moveUci,solutionLine,validateCompletion,forcesMate} from '../lib/practice.ts';

test('every theme has practice and all original positions and solution replies are legal',()=>{
 assert.equal(new Set(puzzles.map(p=>p.id)).size,puzzles.length);
 for(const theme of themes)assert.ok(puzzles.some(p=>p.theme===theme.id)||scenarios.some(s=>s.theme===theme.id),theme.name);
 for(const theme of themes)assert.equal(puzzles.filter(p=>p.theme===theme.id).length,8,`${theme.name}: eight teaching drills`);
 for(const p of puzzles){const c=new Chess(p.fen);assert.ok(!c.isGameOver(),p.id);const other=c.turn()==='w'?'b':'w';c.load(c.fen().replace(` ${c.turn()} `,` ${other} `));assert.ok(!c.isCheck(),`${p.id}: opponent cannot already be in check`);
  for(const line of p.lines||[solutionLine(p)]){const game=new Chess(p.fen);for(const move of line)assert.ok(moveUci(game,move),`${p.id}: ${move}`);assert.ok(validateCompletion(p,line),p.id);}
 }
 assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);
 for(const s of scenarios){const c=new Chess(s.fen);assert.equal(c.turn(),s.color);assert.ok(!c.isGameOver(),s.id);const other=c.turn()==='w'?'b':'w';const opponent=new Chess(s.fen.replace(` ${c.turn()} `,` ${other} `));assert.ok(!opponent.isCheck(),`${s.id}: opponent cannot already be in check`);}
});
test('endgame combinations match their descriptions and every scenario can be played and saved',()=>{
 const combinations:Record<string,[Record<string,number>,Record<string,number>]>={
  'ending-rooks-six':[{k:1,r:1,p:6},{k:1,r:1,p:6}],
  'ending-bishops-five':[{k:1,b:1,p:5},{k:1,b:1,p:5}],
  'ending-knights-five':[{k:1,n:1,p:5},{k:1,n:1,p:5}],
  'ending-bishop-knight':[{k:1,b:1,p:5},{k:1,n:1,p:5}],
  'ending-opposite-bishops':[{k:1,b:1,p:4},{k:1,b:1,p:4}],
  'ending-rook-knight':[{k:1,r:1,n:1,p:4},{k:1,r:1,n:1,p:4}],
  'ending-rook-bishop':[{k:1,r:1,b:1,p:4},{k:1,r:1,b:1,p:4}],
 };
 for(const [id,expected] of Object.entries(combinations)){
  const scenario=scenarios.find(s=>s.id===id)!;assert.ok(scenario,id);const pieces=new Chess(scenario.fen).board().flat().filter(p=>p!==null);
  for(const [i,color] of (['w','b'] as const).entries())for(const type of ['k','q','r','b','n','p'])assert.equal(pieces.filter(p=>p.color===color&&p.type===type).length,expected[i][type]||0,`${id} ${color} ${type}`);
 }
 const opposite=scenarios.find(s=>s.id==='ending-opposite-bishops')!;const bishops=new Chess(opposite.fen).board().flat().filter(p=>p?.type==='b');assert.notEqual((bishops[0]!.square.charCodeAt(0)+Number(bishops[0]!.square[1]))%2,(bishops[1]!.square.charCodeAt(0)+Number(bishops[1]!.square[1]))%2);
 for(const scenario of scenarios){const c=new Chess(scenario.fen);for(let ply=0;ply<4&&!c.isGameOver();ply++)c.move(c.moves()[0]);const replay=new Chess();replay.loadPgn(c.pgn());assert.equal(replay.fen(),c.fen(),scenario.id);}
 assert.equal(scenarios.filter(s=>s.theme==='attack').length,3);assert.equal(scenarios.filter(s=>s.theme==='defense').length,3);
});
test('queenless endgame has the requested material, scattered pieces and a playable saved position',()=>{
 const scenario=scenarios.find(s=>s.id==='ending-queenless-mixed')!;assert.ok(scenario);
 const game=new Chess(scenario.fen),pieces=game.board().flat().filter(p=>p!==null);
 for(const color of ['w','b'] as const){
  const own=pieces.filter(p=>p.color===color);
  for(const [type,count] of Object.entries({k:1,r:1,b:1,n:1,p:6,q:0}))assert.equal(own.filter(p=>p.type===type).length,count,`${color} ${type}`);
  assert.equal(own.length,10);
  const side=new Chess(scenario.fen.replace(' w ',' '+color+' '));assert.ok(!side.isCheck());assert.ok(!side.isGameOver());
 }
 assert.equal(new Set(pieces.map(p=>p.square[1])).size,8,'Pieces should be scattered over every rank');
 assert.ok(pieces.filter(p=>p.type==='p').every(p=>p.square[1]!=='1'&&p.square[1]!=='8'));
 assert.equal(game.fen().split(' ')[2],'-','Endgame has no castling rights');
 game.move(game.moves()[0]);const saved=new Chess();saved.loadPgn(game.pgn());assert.equal(saved.fen(),game.fen());assert.equal(saved.getHeaders().FEN,scenario.fen);
});
test('mate-in-two drills force mate against every legal defense and have no mate in one',()=>{
 for(const p of puzzles.filter(p=>p.mate===2)){const c=new Chess(p.fen);assert.ok(!forcesMate(c,c.turn(),1),`${p.id}: unexpected mate in 1`);assert.ok(forcesMate(c,c.turn(),3),p.id);}
});
test('promotion lesson distinguishes stalemate from rook underpromotion',()=>{
 const p=puzzles.find(p=>p.id==='endgame-stalemate')!;const q=new Chess(p.fen);moveUci(q,'c7c8q');assert.ok(q.isStalemate());const r=new Chess(p.fen);moveUci(r,'c7c8r');assert.ok(!r.isGameOver());assert.ok(r.moves().includes('Ka6'));
});
test('training rejects incomplete and illegal solutions but accepts alternative mating moves',()=>{
 const p=puzzles.find(p=>p.id==='mate-ladder')!;assert.equal(validateCompletion(p,[]),false);assert.equal(validateCompletion(p,['a6a7']),false);assert.equal(validateCompletion(p,['a6a7','e8e7','h1h8']),false);assert.ok(validateCompletion(p,['h1h7','e8d8','a6a8']));
});
