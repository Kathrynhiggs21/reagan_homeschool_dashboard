/* Seed weeklyTopics with IH 5th-grade content for Apr 27 -> Jun 8 (school year end).
 * Sources: Mr. Wells 4th-quarter inquiry PDF + Mr. Froehlich weekly updates pulled from Gmail.
 * Also tags matching ladder skills with ihWeekTag so SkillBuilder prefers them. */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname, port: parseInt(url.port || '4000'),
  user: url.username, password: decodeURIComponent(url.password),
  database: url.pathname.slice(1), ssl: { rejectUnauthorized: false },
});

// Six remaining IH weeks for the school year (Mondays).
// W21-W26 mapping from Wells PDF homework links + Froehlich's weekly cadence.
const WEEKS = [
  { weekStartDate: '2026-04-27', label: 'Q4-W21', topics: {
    science: ['Scientific Inquiry intro: observation vs inference', 'Vocabulary: variable, constant, data, results, model'],
    math:    ['Volume of rectangular prisms (V = l x w x h)', 'Convert measurement units within the same system'],
    ela:     ['Informational text: main idea + supporting details', 'Persuasive writing — opinion piece with reasons'],
    ss:      ['American Revolution: causes -> events -> outcomes review'],
  }},
  { weekStartDate: '2026-05-04', label: 'Q4-W22', topics: {
    science: ['Identifying variables in an experiment (independent / dependent / constant)', 'Mind-Map a question you have'],
    math:    ['Multiply multi-digit whole numbers (standard algorithm)', 'Divide 4-digit by 2-digit numbers'],
    ela:     ['Compare two informational texts on the same topic', 'Cite text evidence (R-AVID)'],
    ss:      ['Westward Expansion: Lewis & Clark, Louisiana Purchase'],
  }},
  { weekStartDate: '2026-05-11', label: 'Q4-W23', topics: {
    science: ['Design + conduct an experiment: Paper Towel Test', 'Record data + draw conclusions'],
    math:    ['Add + subtract fractions with unlike denominators', 'Word problems with fraction answers'],
    ela:     ['Theme in literature: how characters change', 'Narrative writing — small moment story'],
    ss:      ['Industrialization + immigration (turn of 20th century)'],
  }},
  { weekStartDate: '2026-05-18', label: 'Q4-W24', topics: {
    science: ['Analyze + interpret data: tables, bar graphs', 'Communicate results clearly'],
    math:    ['Multiply fractions (including by whole numbers)', 'Divide unit fractions by whole numbers'],
    ela:     ['Author\u2019s purpose + point of view', 'Research notes + paraphrasing (no copy/paste)'],
    ss:      ['Civil Rights Movement: people + key events'],
  }},
  { weekStartDate: '2026-05-25', label: 'Q4-W25', topics: {
    science: ['End-of-Year review: scientific inquiry vocabulary quiz prep'],
    math:    ['Decimal place value to thousandths', 'Add + subtract decimals'],
    ela:     ['Figurative language: metaphor, simile, personification', 'Editing for capitalization + punctuation'],
    ss:      ['Modern era + civic engagement (you can change things)'],
  }},
  { weekStartDate: '2026-06-01', label: 'Q4-W26', topics: {
    science: ['Vocabulary Quiz (Quizlet) + EOY celebration', 'Choose-your-own science wonder project'],
    math:    ['Coordinate plane: plot + interpret points', 'Patterns + simple algebraic thinking'],
    ela:     ['Free-choice reading + book talk', 'Reflective writing: \u201cwhat I learned in 5th grade\u201d'],
    ss:      ['Year wrap-up: timeline of US history'],
  }},
];

let inserted = 0, updated = 0, tagged = 0;

for (const w of WEEKS) {
  for (const subj of Object.keys(w.topics)) {
    const topics = w.topics[subj];
    const notes = `Indian Hill 5th grade · ${w.label} · imported from Wells PDF + Froehlich weekly updates`;
    // Upsert by (weekStartDate, subjectSlug)
    const [existing] = await conn.query(
      'SELECT id FROM weeklyTopics WHERE weekStartDate=? AND subjectSlug=?',
      [w.weekStartDate, subj]
    );
    if (existing.length) {
      await conn.query('UPDATE weeklyTopics SET topics=?, notes=? WHERE id=?',
        [JSON.stringify(topics), notes, existing[0].id]);
      updated++;
    } else {
      await conn.query('INSERT INTO weeklyTopics (weekStartDate, subjectSlug, topics, notes) VALUES (?,?,?,?)',
        [w.weekStartDate, subj, JSON.stringify(topics), notes]);
      inserted++;
    }
  }
}

// Tag matching skill ladder rows with the ihWeekTag for the *current* IH week
// so SkillBuilderTile can surface them. Map by keyword matching against title/strand.
const KEY_TO_WEEK = [
  // W21 — current week
  { week: 'Q4-W21', keys: ['volume', 'measurement', 'main idea', 'opinion', 'persuasive', 'observation', 'inference'] },
  // W22
  { week: 'Q4-W22', keys: ['multiply', 'multi-digit', 'divide', 'compare', 'evidence', 'variable'] },
  // W23
  { week: 'Q4-W23', keys: ['fraction', 'unlike', 'theme', 'narrative', 'experiment'] },
  // W24
  { week: 'Q4-W24', keys: ['multiply fraction', 'divide', 'point of view', 'author', 'data'] },
  // W25
  { week: 'Q4-W25', keys: ['decimal', 'figurative', 'metaphor', 'edit'] },
  // W26
  { week: 'Q4-W26', keys: ['coordinate', 'pattern', 'reflect'] },
];
for (const { week, keys } of KEY_TO_WEEK) {
  for (const k of keys) {
    const [r] = await conn.query(
      'UPDATE skillLadder SET ihWeekTag=? WHERE ihWeekTag IS NULL AND (LOWER(title) LIKE ? OR LOWER(strand) LIKE ?)',
      [week, `%${k}%`, `%${k}%`]
    );
    tagged += r.affectedRows || 0;
  }
}

console.log(`weeklyTopics → inserted ${inserted}, updated ${updated} | skillLadder tagged ${tagged} rows`);
await conn.end();
