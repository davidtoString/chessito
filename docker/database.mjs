import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
export function initializeDatabase(root=process.env.CHESSITO_DATA_DIR||'/data',migrations=path.resolve('drizzle')){
 mkdirSync(root,{recursive:true});const file=path.join(root,'chessito.sqlite');const fresh=!existsSync(file);
 const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS chessito_migrations (name TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS chessito_metadata (name TEXT PRIMARY KEY);');
 for(const name of readdirSync(migrations).filter(n=>n.endsWith('.sql')).sort()){
  if(db.prepare('SELECT name FROM chessito_migrations WHERE name=?').get(name))continue;
  db.exec('BEGIN IMMEDIATE');try{db.exec(readFileSync(path.join(migrations,name),'utf8'));db.prepare('INSERT INTO chessito_migrations VALUES (?)').run(name);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
 if(!db.prepare("SELECT name FROM chessito_metadata WHERE name='legacy-import-complete'").get()){
  const legacyDir=path.join(root,'state','v3','d1','miniflare-D1DatabaseObject');
  if(existsSync(legacyDir))for(const name of readdirSync(legacyDir).filter(n=>n.endsWith('.sqlite'))){
   const legacy=new DatabaseSync(path.join(legacyDir,name),{readOnly:true});
   try{if(!legacy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='games'").get())continue;
    db.exec('BEGIN IMMEDIATE');try{
     for(const g of legacy.prepare('SELECT * FROM games').all())db.prepare('INSERT OR IGNORE INTO games (user_id,id,data,updated_at) VALUES (?,?,?,?)').run(g.user_id,g.id,g.data,g.updated_at);
     for(const p of legacy.prepare('SELECT * FROM preferences').all())db.prepare('INSERT OR IGNORE INTO preferences (user_id,data,encrypted_key) VALUES (?,?,?)').run(p.user_id,p.data,p.encrypted_key);
     db.exec('COMMIT');console.log('Existing chess games and settings migrated to production SQLite.');
    }catch(e){db.exec('ROLLBACK');throw e;}
   }finally{legacy.close();}
  }
  db.prepare("INSERT INTO chessito_metadata VALUES ('legacy-import-complete')").run();
 }
 return db;
}
export function d1Adapter(db){
 function prepare(sql,params=[]){return {
  bind(...values){return prepare(sql,values.map(v=>v===undefined?null:v));},
  async run(){const r=db.prepare(sql).run(...params);return {success:true,results:[],meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},
  async all(){return {success:true,results:db.prepare(sql).all(...params),meta:{}};},
  async raw(){const stmt=db.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...params);},
  async first(column){const row=db.prepare(sql).get(...params);return column?row?.[column]??null:row??null;},
 };}
 return {prepare,async batch(statements){db.exec('BEGIN IMMEDIATE');try{const result=[];for(const s of statements)result.push(await s.all());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
