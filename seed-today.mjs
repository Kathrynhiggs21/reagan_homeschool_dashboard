import "dotenv/config";
import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const today = new Date().toISOString().slice(0,10);
const [existing] = await conn.execute("SELECT id FROM dailyPlans WHERE date = ?", [today]);
let planId;
if (existing.length === 0) {
  const [r] = await conn.execute("INSERT INTO dailyPlans (date, dayType, status) VALUES (?, ?, ?)", [today, "standard", "active"]);
  planId = r.insertId;
} else { planId = existing[0].id; }
await conn.execute("DELETE FROM scheduleBlocks WHERE planId = ?", [planId]);
const [subjects] = await conn.query("SELECT id, slug FROM subjects");
const subBySlug = Object.fromEntries(subjects.map(s => [s.slug, s.id]));
const blocks = [
  ["morning_warmup","Morning Wonder","Spend a few minutes with the parakeets or ducklings. Notice one new thing today.","choice",15,1],
  ["math","Math: Cozy Puzzles","Work through a couple of math problems — maybe duckling-themed today.","math",30,2],
  ["custom","Science: Animal Observation","Pick one animal and write 3 things you noticed about them today.","science",30,3],
  ["custom","Snack & Sit","Snack, water, sit somewhere comfy. No screen needed.",null,15,4],
  ["read_aloud","ELA: Read with the Birds","Read 1-2 chapters of Tuck Everlasting near the parakeets.","ela",30,5],
  ["adventure","Adventure of the Day","Outside time — creek, hike, or backyard.","adventure",45,6],
  ["choice","Choice Block","Whatever YOU want. Art, makeup, baking, building.","choice",30,7],
  ["catch_up","Cozy Wrap-Up","One thing you're proud of from today.",null,10,8],
];
for (const [bt,t,d,subSlug,m,o] of blocks) {
  await conn.execute(
    "INSERT INTO scheduleBlocks (planId, blockType, subjectId, title, description, durationMin, sortOrder, status) VALUES (?,?,?,?,?,?,?,?)",
    [planId, bt, subSlug ? (subBySlug[subSlug] || null) : null, t, d, m, o, "not_started"]
  );
}
console.log("Seeded", blocks.length, "blocks for", today);
await conn.end();
