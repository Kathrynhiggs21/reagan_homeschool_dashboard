// One-off: delete vitest-seeded book rows that leaked into production DB.
import mysql from "mysql2/promise";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}
const conn = await mysql.createConnection(url);
const [before] = await conn.query(
  "SELECT id, title FROM books WHERE LOWER(title) LIKE '%__vitest%'",
);
console.log("matched rows:", before);
const [res] = await conn.query(
  "DELETE FROM books WHERE LOWER(title) LIKE '%__vitest%'",
);
console.log("deleted:", res.affectedRows);
await conn.end();
