import mysql from "mysql2/promise";
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectTimeout: 10000 });
const [tables] = await c.execute("SHOW TABLES LIKE 'daily_printables'");
console.log("EXISTS:", JSON.stringify(tables));
if (tables.length) {
  const [cols] = await c.execute("SHOW COLUMNS FROM daily_printables");
  console.log("COLUMNS:");
  for (const col of cols) console.log("  ", col.Field, "|", col.Type, "|null=", col.Null, "|default=", col.Default);
}
await c.end();
process.exit(0);
