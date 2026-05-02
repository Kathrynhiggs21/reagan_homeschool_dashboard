/**
 * seedHomeTeam.mjs
 *
 * Seeds Reagan's home team into the tutors table:
 *   - Madison (Mon + Wed 10\u201315) \u2014 placeholder email madison@tbd.local
 *   - Sophie  (Tue + Fri 10\u201315) \u2014 placeholder email sophie@tbd.local
 *   - Keith   (Thu 11\u201314)      \u2014 placeholder email keith@tbd.local
 *   - Grandma Marcy             \u2014 marcy.spear@gmail.com, role=editor
 *
 * Idempotent. Safe to re-run; updates fields on existing rows by name.
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

const team = [
  { name: "Madison",       role: "tutor",  email: "madison@tbd.local", subjects: "math,ela,science", notes: "Mon + Wed 10:00\u201315:00. Email TBD." },
  { name: "Sophie",        role: "tutor",  email: "sophie@tbd.local",  subjects: "ela,ss,science",   notes: "Tue + Fri 10:00\u201315:00. Email TBD." },
  { name: "Keith",         role: "tutor",  email: "keith@tbd.local",   subjects: "math,science",     notes: "Thu 11:00\u201314:00. Email TBD." },
  { name: "Grandma Marcy", role: "editor", email: "marcy.spear@gmail.com", subjects: "all",          notes: "Editor tier \u2014 same edit power as tutors, no billing/secrets." },
];

let added = 0, updated = 0;
for (const t of team) {
  const [rows] = await conn.execute(`SELECT id FROM tutors WHERE name = ? LIMIT 1`, [t.name]);
  if (rows.length > 0) {
    await conn.execute(
      `UPDATE tutors SET role=?, email=?, subjects=?, notes=?, active=1 WHERE id=?`,
      [t.role, t.email, t.subjects, t.notes, rows[0].id],
    );
    updated++;
    console.log(`\u2713 updated ${t.name} (id=${rows[0].id})`);
  } else {
    const [r] = await conn.execute(
      `INSERT INTO tutors (name, role, email, subjects, notes, active) VALUES (?, ?, ?, ?, ?, 1)`,
      [t.name, t.role, t.email, t.subjects, t.notes],
    );
    added++;
    console.log(`\u2713 inserted ${t.name} (id=${r.insertId})`);
  }
}

const [final] = await conn.query(
  `SELECT id, name, role, email, subjects FROM tutors WHERE active=1 ORDER BY id`,
);
console.log("\nActive home team:");
console.table(final);

await conn.end();
console.log(`\nDone. inserted=${added} updated=${updated}`);
process.exit(0);
