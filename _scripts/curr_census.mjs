/**
 * curr_census.mjs — quick read-only census of curriculumTopics state.
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

const [rows] = await conn.query(
  "SELECT subject, status, COUNT(*) AS c FROM curriculumTopics GROUP BY subject, status ORDER BY subject, status"
);
console.log("Subject / Status:");
console.table(rows);

const [tops] = await conn.query(
  "SELECT subject, COUNT(*) AS c FROM curriculumTopics WHERE parent_id IS NULL GROUP BY subject"
);
console.log("\nTop-level (units) per subject:");
console.table(tops);

const [q] = await conn.query(
  "SELECT subject, IFNULL(quarter,'(none)') AS quarter, COUNT(*) AS c FROM curriculumTopics GROUP BY subject, quarter ORDER BY subject, quarter"
);
console.log("\nQuarter:");
console.table(q);

const [sample] = await conn.query(
  "SELECT id, subject, code, title, parent_id, quarter, status FROM curriculumTopics ORDER BY subject, ord LIMIT 25"
);
console.log("\nSample rows:");
console.table(sample);

await conn.end();
