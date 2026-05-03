import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

describe("migration 0043 — scheduleBlocks.curriculumTopicId", () => {
  it("adds nullable curriculumTopicId column if missing", async () => {
    const db = getDb();
    try {
      await db.execute(sql`ALTER TABLE scheduleBlocks ADD COLUMN curriculumTopicId int`);
    } catch (e: any) {
      const msg = String(e?.message ?? e?.cause?.message ?? e ?? "");
      const code = e?.code ?? e?.cause?.code ?? "";
      if (code !== "ER_DUP_FIELDNAME" && !/Duplicate column name/i.test(msg)) throw e;
    }
    const cols: any = await db.execute(
      sql`SELECT COLUMN_NAME FROM information_schema.columns WHERE table_name = 'scheduleBlocks' AND column_name = 'curriculumTopicId'`,
    );
    const list: any[] = Array.isArray(cols) ? (cols[0] ?? cols) : (cols as any).rows ?? [];
    expect(list.length).toBe(1);
  }, 30_000);
});
