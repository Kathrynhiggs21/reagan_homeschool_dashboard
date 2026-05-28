import mysql from 'mysql2/promise';

const KEEPERS = [
  // Exactly 4: 2 academic + 2 novels
  { match: { title: '180 Days of Language Grade 5' } },
  { match: { title: '180 Days of Reading Grade 5' } },
  { match: { title: "Michael's World", authorLike: 'Marcy' } }, // keep the real one, not placeholder
];

const TUCK = {
  title: 'Tuck Everlasting',
  author: 'Natalie Babbitt',
  type: 'novel',
  subjectSlug: 'ela',
  currentPage: 0,
  totalPages: 144,
  notes: 'Core literature — IH reading list. Companion to ELA inference work.',
};

async function main() {
  const c = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    // 1. Find keeper IDs
    const keeperIds = [];
    for (const { match } of KEEPERS) {
      const where = ['title = ?'];
      const params = [match.title];
      if (match.authorLike) { where.push('author LIKE ?'); params.push(`%${match.authorLike}%`); }
      const [rows] = await c.execute(`SELECT id, title, author FROM books WHERE ${where.join(' AND ')} ORDER BY id ASC LIMIT 1`, params);
      if (rows.length === 0) {
        console.log(`[warn] keeper not found: ${match.title}`);
        continue;
      }
      keeperIds.push(rows[0].id);
      console.log(`  keep: [${rows[0].id}] ${rows[0].title} — ${rows[0].author}`);
    }

    // 2. Upsert Tuck Everlasting
    const [tuckExists] = await c.execute('SELECT id FROM books WHERE title = ? LIMIT 1', [TUCK.title]);
    let tuckId;
    if (tuckExists.length > 0) {
      tuckId = tuckExists[0].id;
      await c.execute(
        'UPDATE books SET author=?, type=?, subjectSlug=?, totalPages=?, notes=? WHERE id=?',
        [TUCK.author, TUCK.type, TUCK.subjectSlug, TUCK.totalPages, TUCK.notes, tuckId]
      );
      console.log(`  keep: [${tuckId}] ${TUCK.title} (updated)`);
    } else {
      const [res] = await c.execute(
        'INSERT INTO books (title, author, type, subjectSlug, currentPage, totalPages, notes) VALUES (?,?,?,?,?,?,?)',
        [TUCK.title, TUCK.author, TUCK.type, TUCK.subjectSlug, TUCK.currentPage, TUCK.totalPages, TUCK.notes]
      );
      tuckId = res.insertId;
      console.log(`  add:  [${tuckId}] ${TUCK.title} (new)`);
    }
    keeperIds.push(tuckId);

    // 3. Delete everything else — including orphan bookAssignments first
    const placeholders = keeperIds.map(() => '?').join(',');
    const [others] = await c.execute(`SELECT id, title FROM books WHERE id NOT IN (${placeholders})`, keeperIds);
    if (others.length === 0) {
      console.log('  nothing to delete');
    } else {
      // Clean up bookAssignments referencing these books
      const otherIds = others.map(r => r.id);
      const dp = otherIds.map(()=>'?').join(',');
      const [ba] = await c.execute(`DELETE FROM book_assignments WHERE bookId IN (${dp})`, otherIds).catch(async e => {
        if (e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_BAD_FIELD_ERROR') {
          // Try snake_case or singular name
          const [retry] = await c.execute(`DELETE FROM bookAssignments WHERE bookId IN (${dp})`, otherIds).catch(()=>[[]]);
          return [retry];
        }
        return [{ affectedRows: 0 }];
      });
      console.log(`  deleted ${ba.affectedRows || 0} orphan bookAssignment rows`);
      const [del] = await c.execute(`DELETE FROM books WHERE id NOT IN (${placeholders})`, keeperIds);
      console.log(`  deleted ${del.affectedRows} books:`);
      for (const o of others) console.log(`    - [${o.id}] ${o.title}`);
    }

    // 4. Final state
    const [final] = await c.execute('SELECT id, title, author, type, subjectSlug FROM books ORDER BY type DESC, title ASC');
    console.log('\nFinal bookshelf:');
    console.table(final);
    console.log(`Total books: ${final.length}`);
  } finally {
    await c.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
