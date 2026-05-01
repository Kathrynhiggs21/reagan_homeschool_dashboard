import mysql from "mysql2/promise";
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectTimeout: 10000 });
const [rows] = await c.execute("SELECT id, block_id, title, file_link FROM assignments_library WHERE date_for = '2026-05-01' ORDER BY block_id, id");
for (const r of rows) console.log(r);
console.log("TOTAL:", rows.length);
await c.end();
process.exit(0);
