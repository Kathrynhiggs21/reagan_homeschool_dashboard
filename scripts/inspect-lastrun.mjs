import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);
const [rows] = await conn.execute(
  "SELECT `key`, `value` FROM appSettings WHERE `key` LIKE 'drive.connector.lastRun.%' ORDER BY `key`"
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
