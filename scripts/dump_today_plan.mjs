import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [cols] = await conn.execute("SHOW COLUMNS FROM dailyAgendas");
console.log("cols:", cols.map(c=>c.Field).join(", "));
const [plans] = await conn.execute("SELECT * FROM dailyAgendas ORDER BY id DESC LIMIT 4");
for (const p of plans) console.log("PLAN", JSON.stringify(p).slice(0,200));
// pick the plan with most blocks among recent
const [byplan] = await conn.execute("SELECT planId, COUNT(*) n FROM scheduleBlocks GROUP BY planId ORDER BY planId DESC LIMIT 8");
console.log("\nblock counts by recent plan:", JSON.stringify(byplan));
const pid = byplan[0].planId;
const [blocks] = await conn.execute("SELECT startTime,durationMin,blockType,title,status FROM scheduleBlocks WHERE planId=? ORDER BY startTime, sortOrder",[pid]);
console.log(`\n== blocks for plan ${pid} ==`);
for (const b of blocks) console.log(`${b.startTime} | ${b.durationMin}m | ${b.blockType} | ${String(b.title).replace(/\n/g,' ').slice(0,70)}`);
await conn.end();
