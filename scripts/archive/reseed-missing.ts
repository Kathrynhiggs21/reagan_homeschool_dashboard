import { getDb } from "../server/db";
import { books } from "../drizzle/schema";

const DESIRED = [
  { title: "Tuck Everlasting", author: "Natalie Babbitt", totalPages: 144, currentPage: 1, type: "novel" as const, subjectSlug: "reading" },
];

async function main() {
  const db = await getDb();
  const existing = (await db.select().from(books)) as any[];
  const haveTitles = new Set(existing.map((r) => (r.title || "").trim().toLowerCase()));
  let added = 0;
  for (const d of DESIRED) {
    if (!haveTitles.has(d.title.toLowerCase())) {
      await db.insert(books).values(d as any);
      console.log(`Added: ${d.title}`);
      added++;
    }
  }
  console.log(`Done. Added ${added} missing books.`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
