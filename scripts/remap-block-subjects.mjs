/**
 * One-shot fix: scheduleBlocks rows have subjectId values that point to deleted
 * subject rows. Re-link each block to a valid subject by inferring from title.
 */
import mysql from "mysql2/promise";

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
});

const [subjects] = await conn.query("SELECT id, slug, name FROM subjects");
const bySlug = Object.fromEntries(subjects.map((s) => [s.slug, s.id]));

const KEYWORDS = [
  [/math|number|count|fraction|add|subtract|multiply|division|puzzle/i, "math"],
  [/read|book|story|chapter|library|tuck|aloud/i, "read_aloud"],
  [/writ|journal|spell|grammar|sentence/i, "ela"],
  [/science|nature|animal|observ|experiment|wonder|parakeet|duckling/i, "science"],
  [/history|geography|social|civics|map|world/i, "social_studies"],
  [/adventure|explore|field|outdoor|outside/i, "adventure"],
  [/choice|free|catch.?up/i, "choice"],
  [/art|draw|make|craft/i, "art"],
  [/rescue|care|feed/i, "rescue"],
  [/morning|warm|soft.?start|breakfast/i, "morning_warmup"],
];

const [blocks] = await conn.query("SELECT id, title FROM scheduleBlocks");
let updated = 0;
for (const b of blocks) {
  let slug = null;
  for (const [re, s] of KEYWORDS) {
    if (re.test(b.title)) {
      slug = s;
      break;
    }
  }
  if (!slug) continue;
  const sid = bySlug[slug];
  if (!sid) continue;
  await conn.query("UPDATE scheduleBlocks SET subjectId = ? WHERE id = ?", [sid, b.id]);
  updated++;
}
console.log(`updated ${updated} of ${blocks.length} blocks`);
await conn.end();
