import mysql from 'mysql2/promise';
const c = await mysql.createConnection(process.env.DATABASE_URL);
await c.query("ALTER TABLE `appLinks` MODIFY COLUMN `category` enum('learning','creativity','school','nature','reading','google','video') NOT NULL DEFAULT 'learning';");
console.log('Migration applied ✓');
await c.end();
