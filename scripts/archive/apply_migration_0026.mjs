import mysql from "mysql2/promise";
import fs from "fs";

const sql = fs.readFileSync("drizzle/0026_boring_colonel_america.sql", "utf8");
const stmts = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);

const c = await mysql.createConnection(process.env.DATABASE_URL);
for (const s of stmts) {
  console.log("Running:", s.slice(0, 80) + "...");
  try { await c.query(s); console.log("  ✓ OK"); }
  catch (e) { console.log("  ✗ Error:", e.message); }
}
await c.end();
console.log("Done.");
process.exit(0);
