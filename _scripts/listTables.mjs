import mysql from "mysql2/promise";
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL });
const [r1] = await c.query("SHOW TABLES");
const names = r1.map(o => Object.values(o)[0]);
console.log("ALL TABLES:", names.filter(n => /setting|link|app/i.test(n)));
await c.end();
