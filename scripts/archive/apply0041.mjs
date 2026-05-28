import mysql from "mysql2/promise";

const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
const wanted = [
  ["grade", "varchar(4)"],
  ["schoolYear", "varchar(9)"],
  ["term", "varchar(4)"],
  ["teacher", "varchar(80)"],
  ["courseName", "varchar(120)"],
];
const [rows] = await conn.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'academicRecords'`,
);
const have = new Set(rows.map(r => String(r.COLUMN_NAME)));
for (const [name, type] of wanted) {
  if (!have.has(name)) {
    console.log("ADD", name, type);
    await conn.query(`ALTER TABLE \`academicRecords\` ADD \`${name}\` ${type}`);
  } else {
    console.log("OK ", name);
  }
}
await conn.end();
console.log("Migration 0041 applied.");
