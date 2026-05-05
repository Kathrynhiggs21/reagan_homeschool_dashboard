// scripts/trimCurriculumExtras.mjs
// Permanently delete the 4 "less needed" curriculum topics flagged on May 4 2026.
// Targets are matched by case-insensitive title pattern so we don't depend on exact slugs.

import mysql from "mysql2/promise";

const TARGETS = [
  /pemdas|order of operations/i,
  /place value to billions|place value.*billion|billions.*thousandths/i,
  /real-?world rates? & ratios|real-?world ratios?|early intro/i,
  /volume of rectangular prism/i,
];

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  ssl: url.searchParams.get("sslaccept") === "strict" ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
});

const [rows] = await conn.execute(`SELECT id, title, subject, status FROM curriculumTopics`);
const toDelete = rows.filter(r => TARGETS.some(rx => rx.test(r.title)));

console.log("Matched", toDelete.length, "topics:");
for (const r of toDelete) console.log(" -", r.id, "[", r.subject, "]", r.title, "(status:", r.status, ")");

if (toDelete.length === 0) {
  console.log("Nothing to delete.");
  await conn.end();
  process.exit(0);
}

const ids = toDelete.map(r => r.id);
const placeholders = ids.map(() => "?").join(",");

// Delete dependent resources first to avoid orphans
const [resResult] = await conn.execute(
  `DELETE FROM curriculumResources WHERE topic_id IN (${placeholders})`,
  ids,
);
console.log("Deleted curriculumResources rows:", resResult.affectedRows);

const [topicResult] = await conn.execute(
  `DELETE FROM curriculumTopics WHERE id IN (${placeholders})`,
  ids,
);
console.log("Deleted curriculumTopics rows:", topicResult.affectedRows);

await conn.end();
console.log("Done.");
