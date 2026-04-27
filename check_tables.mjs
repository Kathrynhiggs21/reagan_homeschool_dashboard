import mysql from 'mysql2/promise';
const conn = await mysql.createConnection({uri: process.env.DATABASE_URL, connectTimeout: 8000});
const [rows] = await conn.query('SHOW TABLES');
console.log('Tables:', rows.length);
console.log(rows.map(r=>Object.values(r)[0]).join('\n'));
await conn.end();
