import {Chess} from 'chess.js';
export const MAX_IMPORT_BYTES=100*1024*1024;
export const MAX_IMPORT_GAMES=25000;
export function normalizeUsernames(names:string[]){return [...new Set(names.map(n=>n.trim().normalize('NFC')).filter(Boolean))].slice(0,20);}
export function playerSide(headers:Record<string,string>,names:string[]):'w'|'b'|'both'|null{const known=new Set(names.map(n=>n.trim().normalize('NFC').toLowerCase()));const white=known.has((headers.White||'').trim().normalize('NFC').toLowerCase()),black=known.has((headers.Black||'').trim().normalize('NFC').toLowerCase());return white&&black?'both':white?'w':black?'b':null;}

// Keep lexer state across stream chunks. Result tokens inside headers, comments,
// and variations are ignored. No full-file text() allocation is needed.
export async function* readPgnGames(chunks:AsyncIterable<string>):AsyncGenerator<Chess>{
 let parts:string[]=[],size=0,token='',brace=0,variation=0,header=0,quote=false,escape=false,semicolon=false,count=0;
 function parse(text:string){if(!text.trim()||!/[0-9]+\./.test(text.replace(/\{[^}]*\}/g,'')))return null;const c=new Chess();try{c.loadPgn(text);}catch{throw new Error(`Game ${count+1} contains invalid PGN. Earlier imported games are kept.`);}if(!c.history().length)return null;if(c.history().length>2000)throw new Error(`Game ${count+1} has more than 2,000 plies.`);return c;}
 for await(const chunk of chunks){let start=0;
  for(let i=0;i<chunk.length;i++){const char=chunk[i];size++;if(size>500000)throw new Error(`Game ${count+1} exceeds 500 KB or is missing its result token.`);
   const top=!brace&&!variation&&!header&&!semicolon;
   if(top&&/\s/.test(char)){
    if(['1-0','0-1','1/2-1/2','*'].includes(token)){parts.push(chunk.slice(start,i+1));const game=parse(parts.join(''));parts=[];size=0;start=i+1;token='';if(game){if(++count>MAX_IMPORT_GAMES)throw new Error('Import up to 25,000 games per operation.');yield game;}}
    token='';
   }else if(top&&!['{',';','(','['].includes(char))token+=char;
   else if(top)token='';
   if(semicolon){if(char==='\n')semicolon=false;continue;}
   if(brace){if(char==='}')brace--;continue;}
   if(header){if(quote){if(escape)escape=false;else if(char==='\\')escape=true;else if(char==='"')quote=false;}else if(char==='"')quote=true;else if(char===']')header--;continue;}
   if(char==='{')brace++;else if(char===';')semicolon=true;else if(char==='[')header++;else if(char==='(')variation++;else if(char===')')variation=Math.max(0,variation-1);
  }
  parts.push(chunk.slice(start));
 }
 const tail=parts.join('');if(tail.trim()){const game=parse(tail);if(game){if(++count>MAX_IMPORT_GAMES)throw new Error('Import up to 25,000 games per operation.');yield game;}}
}
export async function* fileChunks(file:File){const reader=file.stream().getReader(),decoder=new TextDecoder();try{for(;;){const {done,value}=await reader.read();if(done)break;yield decoder.decode(value,{stream:true});}yield decoder.decode();}finally{reader.releaseLock();}}
