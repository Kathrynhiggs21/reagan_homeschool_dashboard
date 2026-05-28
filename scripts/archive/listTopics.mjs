import mysql from "mysql2/promise";
const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname, port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
});
const [rows] = await conn.execute(`SELECT id, subject, title FROM curriculumTopics ORDER BY subject, ord`);
for (const r of rows) console.log(r.id, "|", r.subject, "|", r.title);
await conn.end();
