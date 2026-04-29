import mysql from "mysql2/promise";
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await c.query("SELECT MIN(id) AS minId, MAX(id) AS maxId FROM appLinks");
console.log("range:", rows[0]);
await c.end();
