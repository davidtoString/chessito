import test from 'node:test';import assert from 'node:assert/strict';
import {readPgnGames,playerSide} from '../lib/pgn-import.ts';
async function* chunks(text:string,size:number){for(let i=0;i<text.length;i+=size)yield text.slice(i,i+size);}
async function parse(text:string,size=7){const games=[];for await(const game of readPgnGames(chunks(text,size)))games.push(game);return games;}
test('streamed PGN handles result tokens crossing chunks, headers, comments, and variations',async()=>{
 const text='[Event "Test 1-0"]\n[White "100waystoblunder"]\n[Black "Other"]\n\n1. e4 {not a result * 1-0} e5 (1... c5 {1-0 *} 2. Nf3) 2. Nf3 Nc6 *\n\n[Event "Two"]\n[White "Other"]\n[Black "100waystoblunder"]\n\n1. d4 d5 1/2-1/2\n';const games=await parse(text);assert.equal(games.length,2);assert.equal(games[0].history().length,4);assert.equal(games[1].history().length,2);assert.equal(playerSide(games[0].getHeaders(),['100WAYSTOBLUNDER']),'w');assert.equal(playerSide(games[1].getHeaders(),['100waystoblunder']),'b');
});
test('imports thousands of games without requiring the full input in one chunk',async()=>{const text=Array.from({length:1200},(_,i)=>`[Event "Game ${i}"]\n\n1. e4 e5 *\n\n`).join('');assert.equal((await parse(text,4096)).length,1200);});
test('supports headerless games and an unfinished final game without result token',async()=>{assert.equal((await parse('1. e4 e5 *\n1. d4 d5 1-0\n1. c4 c5')).length,3);});
test('invalid game stops import with a useful location',async()=>{await assert.rejects(()=>parse('1. e4 e5 *\n1. e4 e6 2. e4 *'),/Game 2 contains invalid PGN/);});
