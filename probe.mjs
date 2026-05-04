import mysql from "mysql2/promise";
const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  connectTimeout: 10000,
});
console.log("connected");

async function run(label, sql) {
  console.log("\n=== " + label);
  try {
    const [rows] = await conn.query({ sql, timeout: 8000 });
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.log("ERR", e.code, e.sqlMessage || e.message);
  }
}

await run("assignments_library cols", "SHOW COLUMNS FROM assignments_library");
await run("assignments_library matches", "SELECT id, title, subject, status FROM assignments_library WHERE LOWER(title) LIKE '%planet%' OR LOWER(title) LIKE '%solar%' OR LOWER(title) LIKE '%earth%' OR LOWER(title) LIKE '%angle%' OR LOWER(title) LIKE '%degree%' OR LOWER(title) LIKE '%triangle%' OR LOWER(title) LIKE '%circle%' OR LOWER(title) LIKE '%space%' ORDER BY id DESC LIMIT 50");
await run("topic matches", "SELECT id, code, title, subject, status, quarter FROM curriculumTopics WHERE LOWER(title) LIKE '%planet%' OR LOWER(title) LIKE '%solar%' OR LOWER(title) LIKE '%earth%' OR LOWER(title) LIKE '%space%' OR LOWER(title) LIKE '%moon%' OR LOWER(title) LIKE '%circle%' OR LOWER(title) LIKE '%angle%' OR LOWER(title) LIKE '%triangle%' OR LOWER(title) LIKE '%polygon%' OR LOWER(title) LIKE '%degree%' OR LOWER(title) LIKE '%rotation%' OR LOWER(title) LIKE '%orbit%' OR LOWER(title) LIKE '%season%' ORDER BY subject, code");
await run("plan today", "SELECT id, date FROM dailyPlans WHERE date='2026-05-04' LIMIT 1");
await run("scheduleBlocks today", "SELECT id, sortOrder, blockType, title FROM scheduleBlocks WHERE planId=360001 ORDER BY sortOrder");

await conn.end();
console.log("done");
