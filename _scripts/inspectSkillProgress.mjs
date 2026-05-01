import mysql from "mysql2/promise";
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectTimeout: 10000 });
const [cols] = await c.execute("SHOW COLUMNS FROM skillProgress");
console.log("COLS:", cols.map(c => c.Field).join(", "));
const [rows] = await c.execute(
  "SELECT * FROM skillProgress WHERE (confidence > 0 OR level > 0) AND evidenceCount = 0 LIMIT 25",
);
console.log("VIOLATIONS:", rows.length);
for (const r of rows) console.log(r);
await c.end();
process.exit(0);
