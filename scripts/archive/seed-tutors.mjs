// One-off: reset the tutors roster to Mike, Sophie, and the (unnamed) college tutor.
// No email/phone seeded — fields stay blank so nothing fake surfaces in Tutor Handoff.
import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }
const conn = await mysql.createConnection(url);

// Hide any existing tutors (keeps session history intact).
await conn.query("UPDATE tutors SET active = false");
console.log("deactivated previous tutors");

const want = [
  { name: "Mike", role: "tutor", subjects: "" },
  { name: "Sophie", role: "tutor", subjects: "" },
  { name: "College tutor", role: "tutor", subjects: "" },
];

for (const t of want) {
  const [rows] = await conn.query("SELECT id FROM tutors WHERE name = ? LIMIT 1", [t.name]);
  if (rows.length > 0) {
    await conn.query("UPDATE tutors SET active = true, role = ?, subjects = ? WHERE id = ?",
      [t.role, t.subjects, rows[0].id]);
    console.log("reactivated:", t.name);
  } else {
    await conn.query("INSERT INTO tutors (name, role, subjects, active) VALUES (?, ?, ?, true)",
      [t.name, t.role, t.subjects]);
    console.log("inserted:", t.name);
  }
}

const [final] = await conn.query("SELECT id, name, active FROM tutors WHERE active = true");
console.log("active tutors now:", final);
await conn.end();
