import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

describe("migration 0044 — curriculumResources table", () => {
  it("creates curriculumResources table if missing", async () => {
    const db = getDb();
    try {
      await db.execute(sql`CREATE TABLE \`curriculumResources\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`topic_id\` int NOT NULL,
        \`kind\` varchar(32) NOT NULL,
        \`title\` varchar(400) NOT NULL,
        \`url\` varchar(1024),
        \`source\` varchar(64),
        \`notes\` text,
        \`added_by_user_id\` int,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`curriculumResources_id\` PRIMARY KEY(\`id\`)
      )`);
    } catch (e: any) {
      // Drizzle wraps mysql2 errors. Inspect the chain (e, e.cause, e.cause?.cause)
      // for either an "already exists" string or the well-known errno 1050.
      const chain = [e, e?.cause, e?.cause?.cause].filter(Boolean);
      const msg = chain.map((x: any) => String(x?.message ?? x ?? "")).join(" | ");
      const code = chain.map((x: any) => x?.code ?? "").join(" | ");
      const errno = chain.map((x: any) => x?.errno ?? "").join(" | ");
      const sqlState = chain.map((x: any) => x?.sqlState ?? "").join(" | ");
      const isExists =
        /already exists/i.test(msg) ||
        /ER_TABLE_EXISTS_ERROR/.test(code) ||
        /1050/.test(errno) ||
        /42S01/.test(sqlState);
      if (!isExists) throw e;
    }
    const cols: any = await db.execute(
      sql`SELECT COUNT(*) c FROM information_schema.tables WHERE table_name = 'curriculumResources'`,
    );
    const list: any[] = Array.isArray(cols) ? cols[0] ?? cols : (cols as any).rows ?? [];
    expect(Number(list[0]?.c ?? 0)).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
