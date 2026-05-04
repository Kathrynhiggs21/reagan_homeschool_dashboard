import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) { console.error('usage: node apply-sql.mjs <file.sql>'); process.exit(1); }
const raw = readFileSync(path, 'utf8');
const stmts = raw.split(/-->\s*statement-breakpoint|;\s*\n/).map(s => s.trim()).filter(Boolean);

const c = await mysql.createConnection(process.env.DATABASE_URL);
let ok = 0, skipped = 0;
for (const s of stmts) {
  try {
    await c.query(s);
    ok++;
    console.log('OK :', s.split('\n')[0].slice(0, 90));
  } catch (e) {
    const m = String(e?.message || e);
    if (/already exists|Duplicate/i.test(m)) {
      skipped++;
      console.log('SKIP:', s.split('\n')[0].slice(0, 90), '-', m.slice(0, 60));
    } else {
      console.error('FAIL:', s.split('\n')[0].slice(0, 90), '-', m);
      process.exitCode = 1;
    }
  }
}
console.log(`\nDone: ${ok} ok, ${skipped} skipped (already existed).`);
await c.end();
