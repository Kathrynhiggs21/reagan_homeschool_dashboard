import mysql from 'mysql2/promise';
console.log('URL set?', !!process.env.DATABASE_URL);
console.log('Connecting...');
const conn = await mysql.createConnection({uri: process.env.DATABASE_URL, connectTimeout: 8000});
console.log('Connected. Listing tables...');
const [rows] = await conn.query('SHOW TABLES');
console.log('Tables:', rows.length);
console.log(rows.map(r=>Object.values(r)[0]).join(','));
await conn.end();
