/**
 * backfillCurriculumProgress.mjs
 *
 * Marks Q1 + Q2 + Q3 topics as `done` (since Reagan completed everything up to
 * the last quarter at Indian Hill before the home transition). Leaves Q4
 * alone so adults can mark them off as they're worked on this spring.
 *
 * Rules:
 *   - Only flips notStarted -> done (preserves any existing inProgress / done).
 *   - Stamps completed_at to a midpoint date in each quarter so the
 *     completion timeline looks natural (not all on the same day).
 *   - Idempotent. Re-runnable.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }

const conn = await mysql.createConnection({
  uri: url,
  ssl: { rejectUnauthorized: false },
  connectTimeout: 8000,
});

// Approximate completion dates by quarter (school year 2025-2026).
const QUARTER_DATE = {
  Q1: "2025-10-15",
  Q2: "2025-12-15",
  Q3: "2026-03-15",
};

let touched = 0;
for (const [q, date] of Object.entries(QUARTER_DATE)) {
  const [r] = await conn.execute(
    `UPDATE curriculumTopics
       SET status = 'done', completed_at = ?
     WHERE quarter = ? AND status = 'notStarted'`,
    [date, q]
  );
  console.log(`  ${q}: backfilled ${r.affectedRows} topics`);
  touched += r.affectedRows;
}

const [[stat]] = await conn.query(
  "SELECT status, COUNT(*) AS c FROM curriculumTopics GROUP BY status"
);
const [allRows] = await conn.query(
  "SELECT status, COUNT(*) AS c FROM curriculumTopics GROUP BY status"
);
console.log("\nFinal status breakdown:");
console.table(allRows);
console.log(`\nTotal rows touched: ${touched}`);

await conn.end();
