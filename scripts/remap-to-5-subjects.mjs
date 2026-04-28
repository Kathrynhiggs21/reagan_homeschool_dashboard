import mysql from "mysql2/promise";
const u = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: u.hostname, port: Number(u.port||3306),
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database: u.pathname.slice(1), ssl: { rejectUnauthorized: false },
});

const ALIAS = {
  reading: "ela", writing: "ela", spelling: "ela", grammar: "ela", vocab: "ela", vocabulary: "ela", phonics: "ela", literature: "ela",
  ss: "social", history: "social", geography: "social", civics: "social", government: "social",
  art: "specials", music: "specials", pe: "specials", gym: "specials", health: "specials", dance: "specials",
  snack: "other", break: "other", catch_up: "other", adventure: "other", choice: "other", wonder: "other",
  outdoors: "science",
};
const FIVE = ["math","science","social","ela","specials","other"];

// 1. Make sure the 5+1 canonical subjects exist
const CANON = {
  math:     { name: "Math",            color: "#ff8c00", icon: "🔢", sortOrder: 1 },
  science:  { name: "Science",         color: "#1db954", icon: "🔬", sortOrder: 2 },
  social:   { name: "Social Studies",  color: "#8b5cf6", icon: "🌍", sortOrder: 3 },
  ela:      { name: "ELA",             color: "#ec3b6b", icon: "📖", sortOrder: 4 },
  specials: { name: "Specials",        color: "#14b8a6", icon: "🎨", sortOrder: 5 },
  other:    { name: "Other",           color: "#eab308", icon: "📌", sortOrder: 6 },
};
const [existing] = await conn.query("SELECT id, slug FROM subjects");
const bySlug = Object.fromEntries(existing.map(r => [r.slug, r.id]));

for (const slug of FIVE) {
  if (bySlug[slug]) continue;
  const c = CANON[slug];
  const [r] = await conn.execute(
    "INSERT INTO subjects (slug, name, color, emoji, sortOrder) VALUES (?, ?, ?, ?, ?)",
    [slug, c.name, c.color, c.icon ?? null, c.sortOrder]
  );
  bySlug[slug] = r.insertId;
}
// Update canonical rows to new color/name
for (const slug of FIVE) {
  const c = CANON[slug];
  await conn.execute(
    "UPDATE subjects SET name=?, color=?, emoji=?, sortOrder=? WHERE slug=?",
    [c.name, c.color, c.icon ?? null, c.sortOrder, slug]
  );
}

// 2. Remap every legacy subject row by pointing its FKs at the 5 canonical IDs
const [allSubjects] = await conn.query("SELECT id, slug FROM subjects");
const remap = {}; // legacy id -> canonical id
for (const s of allSubjects) {
  const canonSlug = FIVE.includes(s.slug) ? s.slug : (ALIAS[s.slug] || "other");
  const canonId = bySlug[canonSlug];
  if (canonId && s.id !== canonId) remap[s.id] = canonId;
}
console.log("remap plan:", remap);

// Tables that reference subject_id
const ID_TABLES = [["scheduleBlocks", "subjectId"]];
for (const [t, col] of ID_TABLES) {
  for (const [fromId, toId] of Object.entries(remap)) {
    const [r] = await conn.execute(`UPDATE ${t} SET ${col}=? WHERE ${col}=?`, [toId, fromId]);
    if (r.affectedRows) console.log(`  ${t}.${col}: ${fromId} -> ${toId} (${r.affectedRows} rows)`);
  }
}

// Tables that reference subject_slug
const SLUG_TABLES = [["skillsMastery", "subjectSlug"], ["weeklyTopics", "subjectSlug"], ["timelineEvents", "subjectSlug"]];
const ALL_ALIAS = { ...ALIAS };
for (const slug of FIVE) ALL_ALIAS[slug] = slug;
for (const [t, col] of SLUG_TABLES) {
  const [rows] = await conn.query(`SELECT DISTINCT ${col} AS s FROM ${t} WHERE ${col} IS NOT NULL`);
  for (const r of rows) {
    const from = r.s;
    const to = ALL_ALIAS[from.toLowerCase()] || "other";
    if (from !== to) {
      const [u] = await conn.execute(`UPDATE ${t} SET ${col}=? WHERE ${col}=?`, [to, from]);
      if (u.affectedRows) console.log(`  ${t}.${col}: ${from} -> ${to} (${u.affectedRows} rows)`);
    }
  }
}

// 3. Delete orphaned legacy subject rows (anything not in FIVE)
const [del] = await conn.execute(`DELETE FROM subjects WHERE slug NOT IN (${FIVE.map(()=>"?").join(",")})`, FIVE);
console.log("deleted legacy subject rows:", del.affectedRows);

await conn.end();
console.log("done");
