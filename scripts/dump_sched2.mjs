import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
for (const tbl of ["scheduleBlocks","dailyAgendas"]) {
  const [c] = await conn.execute(`SHOW COLUMNS FROM \`${tbl}\``);
  console.log(`\n== ${tbl} cols ==`, c.map(x=>x.Field).join(", "));
}
const [rows] = await conn.execute("SELECT * FROM scheduleBlocks ORDER BY id LIMIT 60");
console.log("\n== scheduleBlocks sample ==");
for (const r of rows) console.log(JSON.stringify(r));
await conn.end();
