/**
 * seed-owned-books.mjs
 *
 * Upserts the four physical books Reagan actually owns, with the confirmed
 * progress values from the user (May 3 2026):
 *   - Tuck Everlasting              -> not_started
 *   - Michael's World               -> in_progress, currentChapter=31
 *   - Spectrum Science Grade 5      -> in_progress_unstructured (scattered pages)
 *   - 180 Days of Language Gr 5     -> in_progress_unstructured (scattered pages)
 *
 * Uses INSERT ... ON DUPLICATE KEY UPDATE based on title (no clean unique on
 * title, so we look up by title + LIKE first and update; insert if missing).
 */
import mysql from "mysql2/promise";
import { URL } from "node:url";

const u = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: u.hostname,
  port: Number(u.port || 4000),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ""),
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  connectTimeout: 8000,
});

const seeds = [
  {
    title: "Tuck Everlasting",
    author: "Natalie Babbitt",
    type: "novel",
    subjectSlug: "ela",
    currentPage: 1,
    currentChapter: 0,
    totalPages: 144,
    totalChapters: 25,
    defaultDailyPageSpan: 10,
    status: "not_started",
    topicCodes: JSON.stringify(["5.RL.1", "5.RL.2", "5.RL.3", "5.RL.4", "5.RL.6", "5.W.3"]),
    notes: "Start at Chapter 1 next ELA novel-study block.",
  },
  {
    title: "Michael's World",
    author: null,
    type: "chapter_book",
    subjectSlug: "ela",
    currentPage: 1,
    currentChapter: 31,
    totalPages: null,
    totalChapters: null,
    defaultDailyPageSpan: 1,
    status: "in_progress",
    topicCodes: JSON.stringify(["5.RL.1", "5.RL.3", "5.RF.4"]),
    notes: "Reagan is currently on Chapter 31. Advance one chapter per session.",
  },
  {
    title: "Spectrum Science Grade 5",
    author: "Spectrum",
    type: "workbook",
    subjectSlug: "science",
    currentPage: 1,
    currentChapter: null,
    totalPages: 160,
    totalChapters: null,
    defaultDailyPageSpan: 3,
    status: "in_progress_unstructured",
    topicCodes: JSON.stringify(["sci.life", "sci.earth", "sci.physical"]),
    notes: "Worked scattered pages with prior tutors. Tutors should mark already-done pages on the Curriculum reconciliation tool the first time they open this book.",
  },
  {
    title: "180 Days of Language for 5th Grade",
    author: "Shell Education",
    type: "workbook",
    subjectSlug: "ela",
    currentPage: 1,
    currentChapter: null,
    totalPages: 192,
    totalChapters: null,
    defaultDailyPageSpan: 1,
    status: "in_progress_unstructured",
    topicCodes: JSON.stringify(["5.L.1", "5.L.2", "5.L.3", "5.L.4", "5.L.5"]),
    notes: "Daily 4-question grammar warm-up. Prior tutors used random pages; tutors should reconcile completed pages on first use.",
  },
];

let inserted = 0, updated = 0;
for (const s of seeds) {
  const [rows] = await conn.query("SELECT id FROM books WHERE title = ? LIMIT 1", [s.title]);
  if (rows.length === 0) {
    await conn.query(
      `INSERT INTO books (title, author, type, subjectSlug, currentPage, currentChapter, totalPages, totalChapters, defaultDailyPageSpan, status, topicCodes, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.title, s.author, s.type, s.subjectSlug, s.currentPage, s.currentChapter, s.totalPages, s.totalChapters, s.defaultDailyPageSpan, s.status, s.topicCodes, s.notes]
    );
    inserted++;
    console.log("INSERT:", s.title);
  } else {
    await conn.query(
      `UPDATE books SET author=?, type=?, subjectSlug=?, currentPage=?, currentChapter=?, totalPages=?, totalChapters=?, defaultDailyPageSpan=?, status=?, topicCodes=?, notes=? WHERE id=?`,
      [s.author, s.type, s.subjectSlug, s.currentPage, s.currentChapter, s.totalPages, s.totalChapters, s.defaultDailyPageSpan, s.status, s.topicCodes, s.notes, rows[0].id]
    );
    updated++;
    console.log("UPDATE:", s.title, "(id=" + rows[0].id + ")");
  }
}

await conn.end();
console.log(`done. inserted=${inserted} updated=${updated}`);
