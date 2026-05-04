import mysql from "mysql2/promise";
console.log("starting...");
const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  connectTimeout: 8000,
  ssl: { rejectUnauthorized: true },
});
console.log("got conn");
const [r] = await conn.query("SELECT 1 AS ok");
console.log(r);
await conn.end();
