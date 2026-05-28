import { createConnection } from "mysql2/promise";
import { readFileSync } from "node:fs";
import { URL } from "node:url";

const file = process.argv[2];
if (!file) { console.error("usage: apply-migration.mjs <sqlfile>"); process.exit(1); }
const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) { console.error("no DATABASE_URL"); process.exit(1); }

const u = new URL(rawUrl);
const cfg = {
  host: u.hostname,
  port: Number(u.port || 4000),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ""),
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  connectTimeout: 8000,
  multipleStatements: true,
};
console.log("connecting to", cfg.host + ":" + cfg.port, "db", cfg.database);

const sql = readFileSync(file, "utf8");
const stmts = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);

let conn;
try {
  conn = await createConnection(cfg);
  console.log("connected");
} catch (e) {
  console.error("CONNECT FAIL:", e.code, e.message);
  process.exit(2);
}
for (const s of stmts) {
  const head = s.split("\n")[0].slice(0, 90);
  try { await conn.query(s); console.log("OK:", head); }
  catch (e) { console.error("ERR:", head, "-", e.code, e.message); }
}
await conn.end();
console.log("done");
process.exit(0);
