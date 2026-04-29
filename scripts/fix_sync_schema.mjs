import mysql from "mysql2/promise";
const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 4000),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
  multipleStatements: true,
});

async function colExists(table, col) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]
  );
  return rows[0].c > 0;
}

const stmts = [];
if (!(await colExists("sync_run_items", "dismissed"))) {
  stmts.push("ALTER TABLE sync_run_items ADD COLUMN dismissed BOOLEAN NOT NULL DEFAULT FALSE");
}
if (!(await colExists("sync_run_items", "flagged"))) {
  stmts.push("ALTER TABLE sync_run_items ADD COLUMN flagged BOOLEAN NOT NULL DEFAULT FALSE");
}
if (!(await colExists("sync_run_items", "parent_note"))) {
  stmts.push("ALTER TABLE sync_run_items ADD COLUMN parent_note VARCHAR(500)");
}
// Widen triggered_by from 8 -> 64
stmts.push("ALTER TABLE sync_runs MODIFY COLUMN triggered_by VARCHAR(64) NOT NULL");

for (const s of stmts) {
  console.log("->", s);
  try { await conn.query(s); console.log("   ok"); }
  catch (e) { console.log("   skip:", e.message); }
}
await conn.end();
console.log("done");
