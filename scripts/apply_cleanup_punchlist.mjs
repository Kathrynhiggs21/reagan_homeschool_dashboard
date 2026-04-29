/**
 * Apply 11_cleanup_punchlist.md from the Reagan handoff bundle.
 * Idempotent — safe to re-run.
 *
 * - Dedupe IEP goals by goalText (lowercase trim)
 * - Dedupe IEP accommodations by accommodationText (lowercase trim)
 * - Delete skillLadder rows whose title or skillCode matches /test/i
 * - Delete books whose title matches /^Test Book/i
 * - Delete adventures whose title contains "Brutus" (Brutus does not exist)
 * - Reset stickers + coinLedger for the owner user (Mom-confirmed)
 */
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await mysql.createConnection({
  uri: url,
  ssl: { rejectUnauthorized: false },
  multipleStatements: true,
});

console.log("=== Cleanup Punchlist ===\n");

// 1. Dedupe IEP goals
const [goals] = await conn.query(
  "SELECT id, LOWER(TRIM(goalText)) AS norm FROM iepGoals ORDER BY id ASC"
);
const seenG = new Map(); // norm -> first id
const dropG = [];
for (const r of goals) {
  if (!r.norm) continue;
  if (seenG.has(r.norm)) dropG.push(r.id);
  else seenG.set(r.norm, r.id);
}
if (dropG.length) {
  await conn.query("DELETE FROM iepGoals WHERE id IN (?)", [dropG]);
}
console.log(`IEP goals: kept ${seenG.size}, deleted ${dropG.length} duplicates`);

// 2. Dedupe IEP accommodations
const [accoms] = await conn.query(
  "SELECT id, LOWER(TRIM(accommodationText)) AS norm FROM iepAccommodations ORDER BY id ASC"
);
const seenA = new Map();
const dropA = [];
for (const r of accoms) {
  if (!r.norm) continue;
  if (seenA.has(r.norm)) dropA.push(r.id);
  else seenA.set(r.norm, r.id);
}
if (dropA.length) {
  await conn.query("DELETE FROM iepAccommodations WHERE id IN (?)", [dropA]);
}
console.log(`IEP accoms: kept ${seenA.size}, deleted ${dropA.length} duplicates`);

// 3. Delete TEST_STRAND / vitest-fixture skill ladder rows
const [skillsRes] = await conn.query(
  "DELETE FROM skillLadder WHERE title REGEXP 'test' OR skillCode REGEXP 'TEST' OR strand REGEXP 'TEST'"
);
console.log(`skillLadder: deleted ${skillsRes.affectedRows} TEST/* rows`);

// 4. Delete Test Book + variants
const [booksRes] = await conn.query(
  "DELETE FROM books WHERE title REGEXP '^Test Book' OR author = 'Tester'"
);
console.log(`books: deleted ${booksRes.affectedRows} Test Book rows`);

// 5. Delete Brutus adventures (Mom: Brutus the bearded dragon does NOT exist)
const [advRes] = await conn.query(
  "DELETE FROM adventures WHERE title LIKE '%Brutus%' OR description LIKE '%Brutus%'"
);
console.log(`adventures: deleted ${advRes.affectedRows} Brutus rows`);

// 6. Reset stickers + coin ledger (Mom approved zero start)
const [stRes] = await conn.query("DELETE FROM stickers");
const [coinRes] = await conn.query("DELETE FROM coinLedger");
const [redRes] = await conn.query("DELETE FROM prizeRedemptions");
const [gwnRes] = await conn.query("DELETE FROM goodWorkNotes");
console.log(
  `rewards reset: stickers ${stRes.affectedRows} | coinLedger ${coinRes.affectedRows} | prizeRedemptions ${redRes.affectedRows} | goodWorkNotes ${gwnRes.affectedRows}`
);

console.log("\n=== Cleanup complete ===");
await conn.end();
