import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [t] = await conn.execute("SHOW TABLES");
const names = t.map(r => Object.values(r)[0]).filter(n => /agenda|block|schedule/i.test(n));
console.log("TABLES:", names.join(", "));
for (const tbl of names) {
  const [c] = await conn.execute(`SHOW COLUMNS FROM \`${tbl}\``);
  console.log(`\n== ${tbl} ==`, c.map(x=>x.Field).join(", "));
}
await conn.end();
