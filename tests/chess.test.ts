import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { gameResult, terminalEval, parsePgnCollection, practiceMove, reviewMove } from '../lib/chess.ts';
test('checkmate and stalemate score from white perspective',()=>{
 const mate=new Chess();for(const m of ['f3','e5','g4','Qh4#'])mate.move(m);
 assert.equal(gameResult(mate),'0-1');assert.equal(terminalEval(mate)?.cp,-10000);
 const draw=new Chess('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1');assert.equal(gameResult(draw),'1/2-1/2');assert.equal(terminalEval(draw)?.cp,0);
});
test('PGN imports multiple games, custom start, and rejects illegal moves',()=>{
 const a='[Event "One"]\n[White "A"]\n[Black "B"]\n\n1. e4 e5 2. Nf3 *';
 const b='[Event "Two"]\n[White "C"]\n[Black "D"]\n\n1. d4 d5 *';
 assert.equal(parsePgnCollection(a+'\n\n'+b).length,2);
 assert.throws(()=>parsePgnCollection('1. e4 e5 2. Qh9 *'));
 const custom='[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=N *';assert.equal(parsePgnCollection(custom)[0].get('a8')?.type,'n');
});
test('review loss is correct for each moving side',()=>{
 const c=new Chess();const w=c.move('e4');const b=c.move('e5');
 const before={cp:80,best:'e2e4',depth:12};const after={cp:20,best:'e7e5',depth:12};
 assert.equal(reviewMove(w,before,after,1).loss,60);
 assert.equal(reviewMove(b,after,{cp:220,best:'g1f3',depth:12},2).loss,200);
 assert.equal(reviewMove(b,after,{cp:-220,best:'g1f3',depth:12},2).loss,0);
});
test('practice engine makes legal moves at every level without altering board',()=>{
 for(let level=0;level<4;level++){const c=new Chess();c.move('e4');const fen=c.fen();const uci=practiceMove(c,level);assert.equal(c.fen(),fen);assert.ok(c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'}));}
});
test('castling and en passant survive PGN roundtrip',()=>{
 const c=new Chess();for(const m of ['e4','a6','e5','d5','exd6','exd6','Nf3','Nf6','Be2','Be7','O-O'])c.move(m);
 const copy=new Chess();copy.loadPgn(c.pgn());assert.equal(copy.fen(),c.fen());assert.equal(copy.get('g1')?.type,'k');
});
