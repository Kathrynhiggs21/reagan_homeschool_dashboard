/**
 * Seed starter books onto Reagan's Bookshelf.
 *
 * Idempotent: checks for an existing row with the same (title, author) before
 * inserting. Safe to run multiple times.
 *
 * Run:  node scripts/seed-starter-books.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Kid-appropriate, widely available 5th-grade friendly starter shelf.
// `currentPage` stays at 1 so she sees progress when she reads.
const STARTER = [
  {
    title: "Tuck Everlasting",
    author: "Natalie Babbitt",
    type: "novel",
    subjectSlug: "ela",
    totalPages: 144,
    notes: "Current tutor read-aloud. 5th grade Ohio ELA anchor text.",
  },
  {
    title: "Charlotte's Web",
    author: "E. B. White",
    type: "novel",
    subjectSlug: "ela",
    totalPages: 184,
    notes: "Comfort read. Great for characterization + theme work.",
  },
  {
    title: "Because of Winn-Dixie",
    author: "Kate DiCamillo",
    type: "novel",
    subjectSlug: "ela",
    totalPages: 192,
    notes: "Gentle, animals + found family — strong fit for Reagan.",
  },
  {
    title: "The One and Only Ivan",
    author: "Katherine Applegate",
    type: "novel",
    subjectSlug: "ela",
    totalPages: 305,
    notes: "Newbery winner. Short chapters help regulation.",
  },
  {
    title: "Wonder",
    author: "R. J. Palacio",
    type: "novel",
    subjectSlug: "ela",
    totalPages: 320,
    notes: "Social-emotional rich; multiple narrators.",
  },
  {
    title: "Fractions, Decimals, and Percents",
    author: "David A. Adler",
    type: "reference",
    subjectSlug: "math",
    totalPages: 32,
    notes: "Visual picture book — ties to current math standards.",
  },
  {
    title: "National Geographic Kids Almanac 2026",
    author: "National Geographic Kids",
    type: "reference",
    subjectSlug: "science",
    totalPages: 352,
    notes: "Flip-through science + social studies reference.",
  },
  {
    title: "Who Was Jane Goodall?",
    author: "Roberta Edwards",
    type: "reference",
    subjectSlug: "ss",
    totalPages: 112,
    notes: "Biography — connects to Reagan's animal-rescuer identity.",
  },
  {
    title: "The Milli Adventures",
    author: "Marcy Nyerges",
    type: "novel",
    subjectSlug: "ela",
    totalPages: 48,
    notes: "Grandma's book — Scribbleverse anchor. Reagan loves it.",
  },
];

const conn = await mysql.createConnection(url);

let added = 0;
let skipped = 0;
for (const b of STARTER) {
  const [rows] = await conn.execute(
    "SELECT id FROM books WHERE LOWER(title) = LOWER(?) AND LOWER(COALESCE(author,'')) = LOWER(?) LIMIT 1",
    [b.title, b.author || ""],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    skipped++;
    continue;
  }
  await conn.execute(
    `INSERT INTO books (title, author, type, subjectSlug, currentPage, totalPages, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [b.title, b.author, b.type, b.subjectSlug, 1, b.totalPages, b.notes],
  );
  added++;
  console.log(`  + ${b.title}`);
}

console.log(`Added ${added} starter books, skipped ${skipped} (already present).`);
await conn.end();
