import mysql from 'mysql2/promise';
import fs from 'fs';
const url = process.env.DATABASE_URL;
const sql = fs.readFileSync('./drizzle/0003_calm_clea.sql','utf8');
const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0 && !s.includes('ALTER TABLE `users`'));
const conn = await mysql.createConnection(url);
let ok=0, skip=0, fail=0;
for (const stmt of statements) {
  try { await conn.query(stmt); ok++; }
  catch(e) {
    if (e.code === 'ER_TABLE_EXISTS_ERROR') { skip++; }
    else { console.error('FAIL:', e.code, '-', stmt.split('\n')[0].slice(0,80)); fail++; }
  }
}
console.log(`Done: ok=${ok} skip=${skip} fail=${fail}`);
await conn.end();
