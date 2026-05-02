// One-shot DB updates for the 2026-05-02 role + email reset.
// Tables: camelCase appSettings (id/key/value/updatedAt), appLinks
// value column is plain string (not JSON-wrapped).

import mysql from "mysql2/promise";
const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectTimeout: 8000,
});

async function upsertSetting(key, value) {
  await conn.execute(
    `INSERT INTO appSettings (\`key\`, value, updatedAt)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE value = VALUES(value), updatedAt = NOW()`,
    [key, value],
  );
  console.log(`✓ appSettings[${key}] = ${value}`);
}

await upsertSetting("student.googleEmail", "reaganhiggs910@gmail.com");
await upsertSetting("parent.googleEmail", "spear.cpt@gmail.com");
await upsertSetting("grandma.googleEmail", "marcy.spear@gmail.com");
await upsertSetting("grandma.role", "editor");
await upsertSetting("classroom.studentDomain", "gmail.com");
// Indian Hill 5th-grade curriculum is the reference standard, even though Reagan's IH account is deactivated
await upsertSetting("curriculum.referenceStandard", "Indian Hill 5th Grade");
await upsertSetting("curriculum.gradeLevel", "5");
await upsertSetting("curriculum.endOfYear", "2026-06-04");
// Tutor profiles
await upsertSetting("tutors.madison.weeklySlots", "Mon 10-15,Wed 10-15");
await upsertSetting("tutors.sophie.weeklySlots", "Tue 10-15,Fri 10-15");
await upsertSetting("tutors.keith.weeklySlots", "Thu 11-14");

// Remove school-account-only app_links (PowerSchool, Google Classroom)
const [delPs] = await conn.execute(
  `DELETE FROM appLinks WHERE name LIKE 'PowerSchool%'`,
);
console.log(`✓ removed ${delPs.affectedRows} PowerSchool appLinks`);
const [delGc] = await conn.execute(
  `DELETE FROM appLinks WHERE name = 'Google Classroom'`,
);
console.log(`✓ removed ${delGc.affectedRows} Google Classroom appLinks`);

// Verify
const [check] = await conn.query(
  `SELECT \`key\`, value FROM appSettings WHERE \`key\` IN
   ('student.googleEmail','parent.googleEmail','grandma.googleEmail','grandma.role',
    'classroom.studentDomain','curriculum.referenceStandard','curriculum.endOfYear',
    'tutors.madison.weeklySlots','tutors.sophie.weeklySlots','tutors.keith.weeklySlots')`,
);
console.log("Verified:", check);

await conn.end();
console.log("All role + email updates applied.");
process.exit(0);
