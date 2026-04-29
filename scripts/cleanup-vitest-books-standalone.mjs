import "dotenv/config";
import mysql from "mysql2/promise";
const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL found in dotenv"); process.exit(1); }
const conn = await mysql.createConnection(url);
const [rows] = await conn.query("SELECT id, title FROM books WHERE LOWER(title) LIKE '%__vitest%'");
console.log("matched", rows.length, "rows:");
for (const r of rows) console.log("  -", r.id, r.title);
const [res] = await conn.query("DELETE FROM books WHERE LOWER(title) LIKE '%__vitest%'");
console.log("deleted:", res.affectedRows);
await conn.end();
