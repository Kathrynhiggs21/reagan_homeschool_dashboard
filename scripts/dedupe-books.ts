import { getDb } from "../server/db";
import { books } from "../drizzle/schema";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const rows = await db.select().from(books);
  console.log(`Total books: ${rows.length}`);
  const byTitle = new Map<string, any[]>();
  for (const r of rows as any[]) {
    const k = (r.title || "").trim().toLowerCase();
    if (!byTitle.has(k)) byTitle.set(k, []);
    byTitle.get(k)!.push(r);
  }
  const toDelete: number[] = [];
  for (const [k, group] of byTitle) {
    if (k === "" || k.includes("test") || k.includes("sample") || k === "test book") {
      for (const r of group) toDelete.push(r.id);
      continue;
    }
    if (group.length > 1) {
      group.sort((a: any, b: any) => (b.currentPage || 0) - (a.currentPage || 0) || a.id - b.id);
      for (const r of group.slice(1)) toDelete.push(r.id);
    }
  }
  console.log(`Duplicates + test rows to remove: ${toDelete.length}`);
  console.log("IDs:", toDelete);
  for (const id of toDelete) {
    await db.execute(sql`DELETE FROM books WHERE id = ${id}`);
  }
  const remaining = await db.select().from(books);
  console.log(`\nRemaining books (${remaining.length}):`);
  for (const r of remaining as any[]) console.log(`  #${r.id}: ${r.title}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
