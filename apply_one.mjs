import mysql from 'mysql2/promise';
import fs from 'fs';
const sql = fs.readFileSync('drizzle/0004_unknown_prima.sql','utf-8');
const stmts = sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
const conn = await mysql.createConnection({uri: process.env.DATABASE_URL, multipleStatements:false});
for (const s of stmts) { console.log('apply:', s.slice(0,80)); await conn.query(s); }
console.log('done');
await conn.end();
