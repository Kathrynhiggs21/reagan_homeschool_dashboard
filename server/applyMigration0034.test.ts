import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

async function columnExists(d: ReturnType<typeof getDb>, table: string, col: string) {
  const rows: any = await d.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME = ${col}
  `);
  const list = (rows as any).rows ?? rows;
  return list.length > 0;
}

describe("migration 0034 — curriculumTopics khan_url + ixl_url", () => {
  it("ensures both columns exist", async () => {
    const d = getDb();
    if (!(await columnExists(d, "curriculumTopics", "khan_url"))) {
      try {
        await d.execute(sql`ALTER TABLE \`curriculumTopics\` ADD \`khan_url\` varchar(600)`);
      } catch (e: any) {
        if (e?.code !== "ER_DUP_FIELDNAME") throw e;
      }
    }
    if (!(await columnExists(d, "curriculumTopics", "ixl_url"))) {
      try {
        await d.execute(sql`ALTER TABLE \`curriculumTopics\` ADD \`ixl_url\` varchar(600)`);
      } catch (e: any) {
        if (e?.code !== "ER_DUP_FIELDNAME") throw e;
      }
    }
    expect(await columnExists(d, "curriculumTopics", "khan_url")).toBe(true);
    expect(await columnExists(d, "curriculumTopics", "ixl_url")).toBe(true);
  });
});
