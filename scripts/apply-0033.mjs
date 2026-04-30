// Apply migration 0033_early_iron_fist.sql via the same TiDB connection
// the app uses. Safe to re-run — CREATE TABLE is idempotent with IF NOT EXISTS.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, "..", "drizzle", "0033_early_iron_fist.sql");
const raw = fs.readFileSync(sqlPath, "utf8");
const statements = raw
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

// Make CREATE TABLE idempotent.
const safe = statements.map((s) =>
  s.replace(/^CREATE TABLE `/, "CREATE TABLE IF NOT EXISTS `"),
);

const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
for (const s of safe) {
  try {
    await conn.query(s);
    console.log("ok:", s.slice(0, 60).replace(/\s+/g, " "));
  } catch (e) {
    console.error("FAIL:", e.message);
    process.exit(2);
  }
}
await conn.end();
console.log("migration 0033 applied");
