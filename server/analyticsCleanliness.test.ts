import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

/**
 * Adult Analytics integrity guard.
 *
 * The Adult Analytics page must show ONLY real data entered by the parent,
 * Reagan, or a tutor. This file actively scans the live DB for any rows that
 * look seeded / demo / vitest leftovers and asserts there are none.
 *
 * If this test ever fails, do NOT relax the assertion — find the source of
 * the fake row and either remove it or properly tag it for cleanup.
 */
describe("Adult Analytics cleanliness", () => {
  it("emotionalStruggles has no vitest-fixture / TEST rows", async () => {
    const [rows] = (await getDb().execute(
      sql`SELECT COUNT(*) AS n FROM emotionalStruggles
          WHERE description LIKE '%vitest%' OR description LIKE '%fixture%' OR description LIKE 'TEST%'`
    )) as any;
    expect(Number(rows[0].n)).toBe(0);
  });

  it("proudMoments has no VITEST / TEST rows", async () => {
    const [rows] = (await getDb().execute(
      sql`SELECT COUNT(*) AS n FROM proudMoments
          WHERE title LIKE 'VITEST%' OR title LIKE '%vitest%' OR title LIKE 'TEST%'`
    )) as any;
    expect(Number(rows[0].n)).toBe(0);
  });

  it("skillsMastery has no demo / placeholder rows (canonical IEP ladder is allowed)", async () => {
    // Reagan handoff (Apr 2026) seeded the canonical 45-skill IEP ladder; those rows
    // intentionally have sourceData=null until Reagan practices them. The guard is
    // narrower now: ban anything that looks like a TEST/demo row.
    const [rows] = (await getDb().execute(
      sql`SELECT skillName FROM skillsMastery
          WHERE skillName LIKE 'TEST%' OR skillName LIKE '%vitest%' OR skillName LIKE '%fixture%'
             OR (CAST(sourceData AS CHAR) LIKE '%demo%' OR CAST(sourceData AS CHAR) LIKE '%placeholder%')`
    )) as any;
    expect((rows as any[]).length).toBe(0);
  });

  it("skillProgress: a fresh ladder skill starts at zero level/confidence/evidence", async () => {
    // Rows can exist (one per ladder skill is OK), but they must start at zero
    // and only advance through real practice. We can't audit "real vs fake" individually
    // here, but we can audit that no row claims progress without evidence.
    const [rows] = (await getDb().execute(
      sql`SELECT COUNT(*) AS n FROM skillProgress
          WHERE (confidence > 0 OR level > 0) AND evidenceCount = 0`
    )) as any;
    expect(Number(rows[0].n)).toBe(0);
  });
});
