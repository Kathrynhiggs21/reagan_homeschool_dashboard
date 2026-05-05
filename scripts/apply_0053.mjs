import mysql from 'mysql2/promise';
import fs from 'node:fs';

let url = process.env.DATABASE_URL;
if (!url) {
  const envPath = '/home/ubuntu/reagan_homeschool_dashboard/.env';
  if (fs.existsSync(envPath)) {
    const txt = fs.readFileSync(envPath, 'utf8');
    const m = txt.match(/^DATABASE_URL=(.*)$/m);
    if (m) url = m[1].replace(/^['"]|['"]$/g, '');
  }
}
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }

const c = await mysql.createConnection(url);
try {
  await c.query("ALTER TABLE `tutorDayNotes` ADD `tags` json");
  console.log("OK");
} catch (e) {
  if (String(e?.message||"").includes("Duplicate column")) console.log("Already exists, OK");
  else throw e;
} finally { await c.end(); }
