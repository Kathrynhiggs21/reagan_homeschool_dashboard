import mysql from "mysql2/promise";
const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname, port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
});
const [rows] = await conn.execute(`SELECT id, title, status FROM curriculumTopics WHERE id IN (48,49,50)`);
console.log(JSON.stringify(rows, null, 2));
const r = rows.find(x=>x.id===50);
if (r) console.log("Match test:", /volume formulas for rectangular prisms?/i.test(r.title), "title-codes=", [...r.title].slice(0,30).map(c=>c.charCodeAt(0)));
await conn.end();
