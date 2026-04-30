import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

/**
 * One-shot cleanup: zero-out any skillProgress rows that claim level/confidence
 * but have evidenceCount = 0. These are leftover exploration rows from earlier
 * dev work; the analytics integrity guard requires them to start clean.
 */
describe("cleanup: skillProgress orphans", () => {
  it("zeros out any progress without evidence", async () => {
    const d = getDb();
    await d.execute(
      sql`UPDATE skillProgress
            SET level = 0, confidence = 0
          WHERE (confidence > 0 OR level > 0) AND evidenceCount = 0`,
    );
    const [rows] = (await d.execute(
      sql`SELECT COUNT(*) AS n FROM skillProgress
           WHERE (confidence > 0 OR level > 0) AND evidenceCount = 0`,
    )) as any;
    expect(Number(rows[0].n)).toBe(0);
  });
});
