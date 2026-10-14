import { DatabaseSync } from 'node:sqlite';
import { d1Adapter } from './database.mjs';
const storage=Symbol.for('chessito.sqlite');
function database(){if(!globalThis[storage]){const db=new DatabaseSync((process.env.CHESSITO_DATA_DIR||'/data')+'/chessito.sqlite');db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');globalThis[storage]=d1Adapter(db);}return globalThis[storage];}
export const env={get DB(){return database();},get COACH_ENCRYPTION_KEY(){return process.env.COACH_ENCRYPTION_KEY;}};
