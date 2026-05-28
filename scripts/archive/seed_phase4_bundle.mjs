/**
 * Phase 4 batch seed:
 *   - skillsMastery: upsert canonical 45+ skills with Khan/IXL links + iepGoal
 *   - books: delete Test Book + add 12 read-aloud / series titles
 *   - prizes: upsert 17 tiered prizes (with adult-only marker for "approval" items)
 *   - appLinks: upsert 9 additions + tag accountInfo on existing
 *   - assignmentBacklog: upsert 23 rows from CSV
 *   - learnerProfile.weeklyScheduleTemplate: persist the M–F template
 *
 * Idempotent: each insert uses ON DUPLICATE KEY UPDATE or pre-DELETE-by-natural-key.
 */
import mysql from "mysql2/promise";
import fs from "fs";

const DIR = "/home/ubuntu/reagan_handoff";
const links = JSON.parse(fs.readFileSync(`${DIR}/05_levels_links.json`, "utf8"));
const csvText = fs.readFileSync(`${DIR}/06_assignment_backlog.csv`, "utf8");
const schedule = JSON.parse(fs.readFileSync(`${DIR}/07_weekly_schedule.json`, "utf8"));
const books = JSON.parse(fs.readFileSync(`${DIR}/08_bookshelf_additions.json`, "utf8"));
const prizes = JSON.parse(fs.readFileSync(`${DIR}/09_prizes_catalog.json`, "utf8"));
const apps = JSON.parse(fs.readFileSync(`${DIR}/10_apps_additions.json`, "utf8"));

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let stats = { skillsUpserted: 0, booksAdded: 0, booksDeleted: 0, prizesUpserted: 0, appsUpserted: 0, backlogUpserted: 0 };

/* ----------------------------- 1. SKILLS LINKS ---------------------------- */
const subjectMap = {
  reading_writing: "ela",
  math: "math",
  science: "science",
  social_studies: "ss",
};

for (const [bucketKey, list] of Object.entries(links)) {
  if (bucketKey.startsWith("$") || bucketKey === "remove_skills_named") continue;
  const subject = subjectMap[bucketKey] || bucketKey;
  for (const s of list) {
    if (!s?.skill) continue;
    const skillName = s.skill.slice(0, 200);
    const khan = s.khan ? String(s.khan).slice(0, 500) : null;
    const ixl = s.ixl ? String(s.ixl).slice(0, 200) : null;
    const iepGoal = !!s.iep_goal;
    // Try update existing first; if none, insert
    const [up] = await conn.query(
      "UPDATE skillsMastery SET khanUrl=?, ixlCode=?, iepGoal=? WHERE subjectSlug=? AND skillName=?",
      [khan, ixl, iepGoal, subject, skillName]
    );
    if (up.affectedRows === 0) {
      await conn.query(
        "INSERT INTO skillsMastery (subjectSlug, skillName, currentScore, needsHelp, khanUrl, ixlCode, iepGoal) VALUES (?, ?, 0, 0, ?, ?, ?)",
        [subject, skillName, khan, ixl, iepGoal]
      );
    }
    stats.skillsUpserted += 1;
  }
}

/* ------------------------------- 2. BOOKS --------------------------------- */
for (const title of (books.delete || [])) {
  const [r] = await conn.query("DELETE FROM books WHERE title = ?", [title]);
  stats.booksDeleted += r.affectedRows || 0;
}
for (const b of books.add) {
  // Skip if already present (by title+author)
  const [exists] = await conn.query("SELECT id FROM books WHERE title=? AND (author=? OR author IS NULL)", [b.title, b.author || null]);
  if (exists.length === 0) {
    const note = `${b.icon || ""} ${b.note || ""} ${b.category ? `[${b.category}]` : ""}`.trim();
    await conn.query(
      "INSERT INTO books (title, author, type, subjectSlug, currentPage, notes) VALUES (?, ?, ?, ?, 1, ?)",
      [b.title.slice(0, 200), (b.author || null)?.slice(0, 200) || null, "novel", "ela", note.slice(0, 500) || null]
    );
    stats.booksAdded += 1;
  }
}

/* ------------------------------- 3. PRIZES -------------------------------- */
const PRIZE_CATEGORY_MAP = {
  "Game time": "screen_time",
  "Game": "screen_time",
  "Creative": "experience",
  "Family": "experience",
  "Comfort": "treat",
  "Art": "experience",
  "Animal": "experience",
  "Animal + Outdoor": "experience",
  "Family + Kitchen": "experience",
  "Style": "experience",
  "Animal Rescue": "experience",
  "Animal + Maker": "experience",
  "Adventure": "experience",
};
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64);
}
for (const p of prizes.prizes) {
  const slug = slugify(`${p.tier}-${p.name}`);
  const cat = PRIZE_CATEGORY_MAP[p.category] || "custom";
  const desc = `${p.tier.toUpperCase()} tier · ${p.category}${p.approval ? ` · approval: ${p.approval}` : ""}`;
  const emoji = p.category.includes("Animal") ? "🐾" : p.category.includes("Game") ? "🎮" : p.category.includes("Art") ? "🎨" : p.category.includes("Adventure") ? "🌲" : "⭐";
  await conn.query(
    `INSERT INTO prizes (slug, title, emoji, description, coinCost, category, active)
     VALUES (?, ?, ?, ?, ?, ?, true)
     ON DUPLICATE KEY UPDATE title=VALUES(title), emoji=VALUES(emoji), description=VALUES(description), coinCost=VALUES(coinCost), category=VALUES(category), active=true`,
    [slug, p.name.slice(0, 120), emoji, desc, p.cost_coins, cat]
  );
  stats.prizesUpserted += 1;
}

/* ------------------------------- 4. APPS ---------------------------------- */
const APP_CATEGORY_MAP = {
  "Creative": "creativity",
  "Reading": "reading",
  "Social Studies": "school",
  "Science": "learning",
  "Math + Reading": "learning",
  "Study": "school",
  "Outdoors": "nature",
  "Math": "learning",
};
for (const a of apps.additions) {
  const cat = APP_CATEGORY_MAP[a.category] || "learning";
  const emoji = a.category.includes("Creative") ? "🎨" : a.category.includes("Reading") ? "📖" : a.category.includes("Science") ? "🔬" : a.category.includes("Outdoors") ? "🌲" : "🧠";
  // Look up existing by name
  const [exists] = await conn.query("SELECT id FROM appLinks WHERE name = ?", [a.name]);
  if (exists.length > 0) {
    await conn.query(
      "UPDATE appLinks SET url = ?, category = ?, accountInfo = ?, description = ? WHERE id = ?",
      [a.url, cat, `${a.account || ""} — ${a.use || ""}`.slice(0, 500), a.use || null, exists[0].id]
    );
  } else {
    await conn.query(
      "INSERT INTO appLinks (name, url, category, emoji, description, accountInfo, sortOrder) VALUES (?, ?, ?, ?, ?, ?, 100)",
      [a.name.slice(0, 100), a.url.slice(0, 500), cat, emoji, a.use || null, `${a.account || ""} — ${a.use || ""}`.slice(0, 500)]
    );
  }
  stats.appsUpserted += 1;
}
// Tag account labels on existing apps
for (const [appName, label] of Object.entries(apps.account_labels_to_add_to_existing_apps || {})) {
  await conn.query(
    "UPDATE appLinks SET accountInfo = ? WHERE name = ? AND (accountInfo IS NULL OR accountInfo = '' OR accountInfo NOT LIKE ?)",
    [label, appName, `%${label.split("(")[0].trim().slice(0, 30)}%`]
  );
}

/* ------------------------------ 5. BACKLOG -------------------------------- */
// Parse the CSV (simple — comma-separated, double-quoted)
const lines = csvText.trim().split("\n");
const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
function parseCsvLine(line) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
for (let i = 1; i < lines.length; i++) {
  const cells = parseCsvLine(lines[i]);
  const row = Object.fromEntries(header.map((h, idx) => [h, (cells[idx] || "").trim()]));
  if (!row.id) continue;
  const code = row.id.slice(0, 20);
  const title = (row.title || row.name || row.assignment || code).slice(0, 200);
  const subject = (row.subject || row.subjectSlug || "general").toLowerCase().slice(0, 32);
  const subjectClean = ({ ela: "ela", math: "math", reading: "ela", writing: "ela", science: "science", "social studies": "ss", ss: "ss", regulation: "general", self_advocacy: "general" })[subject] || subject;
  const blockType = (row.block_type || row.blockType || row.type || "").slice(0, 40) || null;
  const est = parseInt(row.minutes || row.est_minutes || row.estMinutes || "25", 10) || 25;
  const weekTheme = (row.week_theme || row.weekTheme || "").slice(0, 80) || null;
  const dayHint = (row.day || row.day_hint || "any").toLowerCase().slice(0, 16) || "any";
  const notes = (row.notes || row.description || "").slice(0, 1000) || null;
  const iepGoal = /iep|goal/i.test(row.iep_goal || row.iepGoal || row.flag || "");
  await conn.query(
    `INSERT INTO assignmentBacklog (code, title, subjectSlug, blockType, estMinutes, weekTheme, dayHint, notes, iepGoal, active, sourceDoc)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true, '06_assignment_backlog.csv')
     ON DUPLICATE KEY UPDATE title=VALUES(title), subjectSlug=VALUES(subjectSlug), blockType=VALUES(blockType), estMinutes=VALUES(estMinutes), weekTheme=VALUES(weekTheme), dayHint=VALUES(dayHint), notes=VALUES(notes), iepGoal=VALUES(iepGoal), active=true`,
    [code, title, subjectClean, blockType, est, weekTheme, dayHint, notes, iepGoal]
  );
  stats.backlogUpserted += 1;
}

/* ------------------------------ 6. SCHEDULE TEMPLATE ----------------------- */
await conn.query(
  "UPDATE learnerProfile SET weeklyScheduleTemplate = ? WHERE studentName = 'Reagan' OR id IS NOT NULL ORDER BY id ASC LIMIT 1",
  [JSON.stringify(schedule)]
);

console.log(JSON.stringify(stats, null, 2));
await conn.end();
