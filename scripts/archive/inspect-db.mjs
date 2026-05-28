import mysql from 'mysql2/promise';
const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: url.port || 4000,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});
const tables = [
  'scheduleBlocks','dailyPlans','adventures','books','timelineEvents',
  'appLinks','academicRecords','needsWorkItems','skillsMastery','weeklyTopics',
  'subjects','learnerProfile','emotionalStruggles','specialDays','animals',
  'rescues','badges','appointments','schoolCalendar','moodLogs','takeNotes',
  'journalEntries','printableSources','printableFavorites','assignmentAnswerKeys',
  'blockGrades','assignmentSubmissions','curriculumAdjustments','helpList','auditLog'
];
for (const t of tables) {
  try {
    const [rows] = await conn.query(`SELECT COUNT(*) as c FROM \`${t}\``);
    console.log(`${t.padEnd(30)} ${rows[0].c}`);
  } catch (e) {
    console.log(`${t.padEnd(30)} ERR ${e.message.slice(0,50)}`);
  }
}
await conn.end();
