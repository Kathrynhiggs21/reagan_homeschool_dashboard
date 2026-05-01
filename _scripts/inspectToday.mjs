import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }

const c = await mysql.createConnection({
  uri: url,
  ssl: { rejectUnauthorized: true },
  connectTimeout: 10000,
});

const today = new Date().toISOString().slice(0, 10);
const [plans] = await c.execute(
  "SELECT id, date, dayType FROM dailyPlans WHERE DATE(date) = ? ORDER BY id DESC LIMIT 5",
  [today],
);
console.log("PLANS_TODAY:", JSON.stringify(plans, null, 2));

const [subs] = await c.execute("SELECT id, slug, name FROM subjects ORDER BY id");
console.log("SUBJECTS:", JSON.stringify(subs, null, 2));

if (plans[0]) {
  const [blocks] = await c.execute(
    "SELECT id, title, blockType, sortOrder, status FROM scheduleBlocks WHERE planId = ? ORDER BY sortOrder",
    [plans[0].id],
  );
  console.log("CURRENT_BLOCKS:", JSON.stringify(blocks, null, 2));
}

await c.end();
process.exit(0);
