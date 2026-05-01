import mysql from "mysql2/promise";
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectTimeout: 10000, multipleStatements: true });
await c.query(`
CREATE TABLE IF NOT EXISTS \`daily_printables\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`for_date\` varchar(10) NOT NULL,
  \`bucket\` varchar(16) NOT NULL,
  \`title\` varchar(256) NOT NULL,
  \`description\` text,
  \`subject_slug\` varchar(64),
  \`skill_ladder_id\` int,
  \`source\` varchar(64) NOT NULL,
  \`source_url\` text,
  \`pdf_key\` varchar(256),
  \`thumb_key\` varchar(256),
  \`est_minutes\` int,
  \`coin_reward\` int NOT NULL DEFAULT 5,
  \`status\` varchar(16) NOT NULL DEFAULT 'pending',
  \`completed_at\` timestamp NULL,
  \`photo_key\` varchar(256),
  \`auto_grade\` text,
  \`drive_file_id\` varchar(128),
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`daily_printables_id\` PRIMARY KEY(\`id\`),
  INDEX \`daily_printables_for_date_idx\` (\`for_date\`)
);
`);
const [tables] = await c.execute("SHOW TABLES LIKE 'daily_printables'");
console.log("AFTER:", JSON.stringify(tables));
await c.end();
process.exit(0);
