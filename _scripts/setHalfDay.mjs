import mysql from "mysql2/promise";
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectTimeout: 10000 });
await c.execute(
  `UPDATE dailyPlans SET notes = ?, dayType = 'half' WHERE id = 120001`,
  ["Half day — afternoon only, ~2 hours. Focus: planets video → solar-system collage → weight-on-planets worksheet → circle/angles/triangles math."],
);
console.log("Plan 120001 marked half-day with notes.");
await c.end();
process.exit(0);
