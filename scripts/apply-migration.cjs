/**
 * One-off migration runner. Reads the latest numbered .sql file in drizzle/
 * and applies its statements individually, tolerating "already exists" errors
 * so the script is idempotent.
 *
 *   node scripts/apply-migration.cjs 0006
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  const target = process.argv[2];
  const dir = path.resolve(__dirname, "..", "drizzle");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql"));
  const pick = target
    ? files.find(f => f.startsWith(target))
    : files.sort().reverse()[0];
  if (!pick) throw new Error("No matching migration file found");
  const sqlPath = path.join(dir, pick);
  const raw = fs.readFileSync(sqlPath, "utf8");
  const stmts = raw
    .split(/--> statement-breakpoint|;\s*\n/g)
    .map(s => s.trim())
    .filter(Boolean);

  console.log(`Applying ${pick} (${stmts.length} statements)...`);
  const conn = await mysql.createConnection(DATABASE_URL);
  for (const s of stmts) {
    try {
      await conn.query(s);
      console.log("OK:", s.split("\n")[0].slice(0, 80));
    } catch (e) {
      if (
        /Duplicate|already exists|Duplicate column|exists/i.test(e.message)
      ) {
        console.log("SKIP:", s.split("\n")[0].slice(0, 80), "-", e.code);
      } else {
        console.error("FAIL:", s.slice(0, 200));
        throw e;
      }
    }
  }
  await conn.end();
  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
