// Idempotent seeder for the Idea Library / Adventure Bank.
// Inserts each idea (matched by title) into the `adventures` table if absent.
// Usage: node scripts/seed_idea_library.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "idea_library_seed.json");
const ideas = JSON.parse(fs.readFileSync(seedPath, "utf8"));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

let inserted = 0;
let skipped = 0;

for (const idea of ideas) {
  const [rows] = await conn.execute(
    "SELECT id FROM adventures WHERE title = ? LIMIT 1",
    [idea.title],
  );
  if (rows.length > 0) {
    skipped++;
    console.log(`skip  : ${idea.title}`);
    continue;
  }

  await conn.execute(
    `INSERT INTO adventures
      (title, description, subjectSlugs, topicTags, interestTags,
       minDurationMin, maxDurationMin, setting, energyLevel, materials,
       instructions, emoji, kind, category, wishlistStatus, isFavorite)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      idea.title,
      idea.description,
      JSON.stringify(idea.subjectSlugs ?? []),
      JSON.stringify(idea.topicTags ?? []),
      JSON.stringify(idea.interestTags ?? []),
      idea.minDurationMin ?? 30,
      idea.maxDurationMin ?? 90,
      idea.setting ?? "either",
      idea.energyLevel ?? "medium",
      JSON.stringify(idea.materials ?? []),
      idea.instructions,
      idea.emoji ?? null,
      idea.kind ?? "general",
      idea.category ?? null,
      idea.wishlistStatus ?? "idea",
      0,
    ],
  );
  inserted++;
  console.log(`insert: ${idea.title}`);
}

console.log(`\nDone. Inserted ${inserted}, skipped ${skipped}, total ${ideas.length}.`);
await conn.end();
