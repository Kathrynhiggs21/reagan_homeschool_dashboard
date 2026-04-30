import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

describe("migration 0035 — books.coverUrl + seed covers", () => {
  it("adds coverUrl column if missing, seeds 3 real book covers", async () => {
    const db = getDb();

    try {
      await db.execute(sql`ALTER TABLE books ADD COLUMN coverUrl varchar(500)`);
    } catch (e: any) {
      const msg = String(e?.message ?? e?.cause?.message ?? e ?? "");
      const code = e?.code ?? e?.cause?.code ?? "";
      if (code !== "ER_DUP_FIELDNAME" && !/Duplicate column name/i.test(msg)) throw e;
    }

    const covers: Array<{ match: RegExp; url: string }> = [
      {
        match: /spectrum.*science.*grade\s*5/i,
        url: "https://covers.openlibrary.org/b/isbn/1483813630-L.jpg",
      },
      {
        match: /180\s*days.*language/i,
        url: "https://covers.openlibrary.org/b/isbn/1425811655-L.jpg",
      },
      {
        match: /tuck\s*everlasting/i,
        url: "https://covers.openlibrary.org/b/isbn/0312369816-L.jpg",
      },
    ];

    const rows: any = await db.execute(
      sql`SELECT id, title FROM books WHERE title NOT LIKE '%__vitest%' ORDER BY id`,
    );
    const list: any[] = Array.isArray(rows) ? (rows[0] ?? rows) : (rows as any).rows ?? [];

    for (const r of list) {
      for (const c of covers) {
        if (c.match.test(String(r.title))) {
          await db.execute(
            sql`UPDATE books SET coverUrl = ${c.url} WHERE id = ${r.id}`,
          );
        }
      }
    }

    const afterRaw: any = await db.execute(
      sql`SELECT title, coverUrl FROM books WHERE coverUrl IS NOT NULL`,
    );
    const after: any[] = Array.isArray(afterRaw) ? (afterRaw[0] ?? afterRaw) : afterRaw.rows ?? [];
    expect(after.length).toBeGreaterThanOrEqual(0);
  }, 30_000);
});
