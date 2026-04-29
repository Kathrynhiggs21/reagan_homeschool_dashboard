// Phase 6 — Apps & Tools prune
// 1. Delete leaked vitest rows ("Test App ..." or url contains example.com/test-)
// 2. Delete stub "App / Link" placeholder
// 3. Upsert the canonical "actually-used" apps for Reagan with stable URLs.
// Anything else in the table is left alone (mom may have added it manually).
import mysql from "mysql2/promise";

const c = await mysql.createConnection(process.env.DATABASE_URL);

// --- Step 1: cleanup test/placeholder rows
const [delTest] = await c.query(
  "DELETE FROM appLinks WHERE name LIKE 'Test App %' OR url LIKE '%example.com/test-%'"
);
console.log(`Deleted ${delTest.affectedRows} test rows.`);
const [delStub] = await c.query(
  "DELETE FROM appLinks WHERE name = 'App' AND url = 'Link'"
);
console.log(`Deleted ${delStub.affectedRows} stub rows.`);

// --- Step 2: canonical set — actually used by Reagan day-to-day
const CANONICAL = [
  // School / academic — daily drivers
  { name: "Khan Academy",     url: "https://www.khanacademy.org",                      category: "school",     emoji: "📚", sortOrder: 1 },
  { name: "IXL",              url: "https://www.ixl.com/signin",                      category: "school",     emoji: "🧠", sortOrder: 2 },
  { name: "Prodigy Math",     url: "https://play.prodigygame.com",                    category: "school",     emoji: "🐉", sortOrder: 3 },
  { name: "BrainPOP",         url: "https://www.brainpop.com",                        category: "school",     emoji: "🤖", sortOrder: 4 },
  { name: "Edpuzzle",         url: "https://edpuzzle.com",                            category: "school",     emoji: "🎬", sortOrder: 5 },
  { name: "Vocabulary.com",   url: "https://www.vocabulary.com",                      category: "school",     emoji: "🔤", sortOrder: 6 },
  // Google
  { name: "Google Classroom", url: "https://classroom.google.com",                    category: "google",     emoji: "📘", sortOrder: 10 },
  { name: "Google Docs",      url: "https://docs.google.com",                         category: "google",     emoji: "📝", sortOrder: 11 },
  { name: "Google Drive",     url: "https://drive.google.com",                        category: "google",     emoji: "📁", sortOrder: 12 },
  { name: "Gmail",            url: "https://mail.google.com",                         category: "google",     emoji: "✉️", sortOrder: 13 },
  // Reading
  { name: "Epic! Books",      url: "https://www.getepic.com",                         category: "reading",    emoji: "📖", sortOrder: 20 },
  { name: "CommonLit",        url: "https://www.commonlit.org/en/library?grade=5",    category: "reading",    emoji: "📰", sortOrder: 21 },
  // Videos
  { name: "Math Antics",      url: "https://www.mathantics.com",                      category: "video",      emoji: "🧮", sortOrder: 30 },
  { name: "Crash Course Kids",url: "https://www.youtube.com/c/crashcoursekids",       category: "video",      emoji: "📺", sortOrder: 31 },
  { name: "Mystery Doug",     url: "https://mysteryscience.com/mystery-doug",         category: "video",      emoji: "🤔", sortOrder: 32 },
  // Nature — Reagan loves these
  { name: "Merlin Bird ID",   url: "https://merlin.allaboutbirds.org",                category: "nature",     emoji: "🐦", sortOrder: 40 },
  { name: "iNaturalist",      url: "https://www.inaturalist.org",                     category: "nature",     emoji: "🌿", sortOrder: 41 },
  // Creative / play (after-work)
  { name: "Roblox",           url: "https://www.roblox.com",                          category: "creativity", emoji: "🟥", sortOrder: 50 },
  { name: "Minecraft",        url: "https://www.minecraft.net",                       category: "creativity", emoji: "🟩", sortOrder: 51 },
  { name: "Toca Boca",        url: "https://tocaboca.com/apps/",                      category: "creativity", emoji: "🌈", sortOrder: 52 },
];

let upsertedNew = 0;
let upsertedUpdated = 0;

for (const a of CANONICAL) {
  // Match by name (case-insensitive). If found, update url/category/emoji/sortOrder. Else insert.
  const [rows] = await c.query("SELECT id FROM appLinks WHERE LOWER(name) = LOWER(?) LIMIT 1", [a.name]);
  if (rows.length > 0) {
    await c.query(
      "UPDATE appLinks SET url = ?, category = ?, emoji = ?, sortOrder = ? WHERE id = ?",
      [a.url, a.category, a.emoji, a.sortOrder, rows[0].id]
    );
    upsertedUpdated++;
  } else {
    await c.query(
      "INSERT INTO appLinks (name, url, category, emoji, sortOrder) VALUES (?, ?, ?, ?, ?)",
      [a.name, a.url, a.category, a.emoji, a.sortOrder]
    );
    upsertedNew++;
  }
}

console.log(`Canonical apps: ${upsertedNew} new, ${upsertedUpdated} updated. Total canonical = ${CANONICAL.length}.`);

const [final] = await c.query("SELECT COUNT(*) AS n FROM appLinks");
console.log(`Final appLinks row count: ${final[0].n}`);

await c.end();
