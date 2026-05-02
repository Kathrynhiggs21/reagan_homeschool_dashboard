/**
 * Replace any stale reagan.higgs33@ihsd.us / school-account references in
 * app_accounts and student.googleEmail prefs with reaganhiggs910@gmail.com.
 */
import mysql from "mysql2/promise";

const NEW_EMAIL = "reaganhiggs910@gmail.com";
const OLD_PATTERNS = ["reagan.higgs33@ihsd.us", "@ihsd.us"];

const c = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  connectTimeout: 10000,
});

// 1. Look at current app_accounts table for stale rows
const [rows] = await c.execute(
  "SELECT id, app_name, sign_in_email, sign_in_username FROM app_accounts WHERE sign_in_email IS NOT NULL OR sign_in_username IS NOT NULL",
);
let updated = 0;
for (const r of rows) {
  const stale =
    OLD_PATTERNS.some(p => (r.sign_in_email || "").includes(p)) ||
    OLD_PATTERNS.some(p => (r.sign_in_username || "").includes(p));
  if (!stale) continue;
  await c.execute(
    "UPDATE app_accounts SET sign_in_email = ?, sign_in_username = NULL, updated_at = NOW() WHERE id = ?",
    [NEW_EMAIL, r.id],
  );
  updated++;
  console.log(`  ↳ ${r.app_name}: ${r.sign_in_email || r.sign_in_username} → ${NEW_EMAIL}`);
}

// 2. Set the central student.googleEmail pref (table is app_settings)
const [prefRows] = await c.execute(
  "SELECT id FROM appSettings WHERE `key` = ?",
  ["student.googleEmail"],
);
if (prefRows.length > 0) {
  await c.execute(
    "UPDATE appSettings SET `value` = ?, updatedAt = NOW() WHERE `key` = ?",
    [NEW_EMAIL, "student.googleEmail"],
  );
  console.log(`Updated appSettings.student.googleEmail → ${NEW_EMAIL}`);
} else {
  await c.execute(
    "INSERT INTO appSettings (`key`, `value`, updatedAt) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updatedAt = NOW()",
    ["student.googleEmail", NEW_EMAIL],
  );
  console.log(`Inserted appSettings.student.googleEmail = ${NEW_EMAIL}`);
}
// Also clear the school domain so nothing tries to send Reagan to indianhill.k12.oh.us
await c.execute(
  "INSERT INTO appSettings (`key`, `value`, updatedAt) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updatedAt = NOW()",
  ["classroom.studentDomain", ""],
);

console.log(`Done. Migrated ${updated} app_accounts row(s).`);
await c.end();
process.exit(0);
