import { Chess, type Color } from 'chess.js';

export function position(turn:Color,pieces:string){
 const board=Array.from({length:8},()=>Array<string>(8).fill(''));
 for(const piece of pieces.split(' ')){
  if(!/^[wb][KQRBNP][a-h][1-8]$/.test(piece))throw new Error('Invalid teaching piece: '+piece);
  const [color,type,file,rank]=piece,row=8-Number(rank),column=file.charCodeAt(0)-97;
  if(board[row][column])throw new Error('Overlapping teaching pieces: '+piece);
  board[row][column]=color==='w'?type.toUpperCase():type.toLowerCase();
 }
 return board.map(row=>{let result='',empty=0;for(const piece of row){if(!piece)empty++;else{if(empty)result+=empty;empty=0;result+=piece;}}return result+(empty||'');}).join('/')+` ${turn} - - 0 1`;
}
export function opening(pgn:string){const game=new Chess();game.loadPgn(pgn);return game.fen();}
