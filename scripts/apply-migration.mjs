import { createConnection } from "mysql2/promise";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: apply-migration.mjs <sqlfile>"); process.exit(1); }
const url = process.env.DATABASE_URL;
if (!url) { console.error("no DATABASE_URL"); process.exit(1); }
const sql = readFileSync(file, "utf8");
const stmts = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
const conn = await createConnection({ uri: url, ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } });
for (const s of stmts) {
  try { await conn.query(s); console.log("OK:", s.split("\n")[0]); }
  catch (e) { console.error("ERR:", s.split("\n")[0], "-", e.message); }
}
await conn.end();
