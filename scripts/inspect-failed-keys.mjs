import mysql from "mysql2/promise";

let url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
// Strip the ssl=... query the runtime injects; mysql2 client doesn't grok it
url = url.replace(/\?ssl=.*$/, "");
const conn = await mysql.createConnection({ uri: url, ssl: { rejectUnauthorized: true } });

// Look up the 4 known failed keys from the v3.23 follow-up note
const failedKeys = [
  "topics/2026-05-30/math-fractions.md",
  "daylogs/2026-05-30.md",
  "recap/2026-05-30/marcy.md",
  "agendas/2026-06-01/v1.pdf",
];

const [rows] = await conn.query(
  `SELECT id, file_key, file_url, file_name, mime_type, target_folder, status, error_message,
          (content_text IS NOT NULL) AS has_text, LENGTH(content_text) AS text_len, created_at
   FROM drive_push_queue
   WHERE file_key IN (?)
   ORDER BY created_at DESC`,
  [failedKeys]
);
console.log("=== rows for the 4 keys ===");
console.log(JSON.stringify(rows, null, 2));

// Also pull most-recent rows by created_at to see the actual recent failures (if any new)
const [recent] = await conn.query(
  `SELECT id, file_key, file_url, file_name, target_folder, status, error_message,
          (content_text IS NOT NULL) AS has_text, created_at
   FROM drive_push_queue
   WHERE error_message IS NOT NULL AND error_message != ''
   ORDER BY created_at DESC
   LIMIT 20`
);
console.log("\n=== recent rows with error_message ===");
console.log(JSON.stringify(recent, null, 2));

await conn.end();
