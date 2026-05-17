import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { getDb, applyForwardPlan } from "./db";

/**
 * Push 2.10 (2026-05-17) — Real-DB integration test for applyForwardPlan.
 *
 * Plan dates are picked far in the future (2027-09) so they never collide
 * with anything Mom or the autobuilder created. After each test we clean up
 * just the plans + blocks we made.
 */

const FUTURE_DATES = ["2027-10-11", "2027-10-12", "2027-10-13"];
const TEST_TOPIC_IDS: number[] = [];

beforeAll(async () => {
  const db = getDb();
  // Reuse 3 real curriculumTopics for the test — pick a stable trio in subjects we know exist.
  const rows = (await db.execute(sql`
    SELECT id FROM curriculumTopics WHERE subject IN ('Math', 'ELA', 'Science') ORDER BY id ASC LIMIT 3
  `)) as any;
  for (const r of (rows[0] || [])) TEST_TOPIC_IDS.push(Number(r.id));
  // Pre-cleanup: wipe any matching rows from prior runs so we start clean.
  for (const d of FUTURE_DATES) {
    const planRow = (await db.execute(sql`SELECT id FROM dailyPlans WHERE date = ${d} LIMIT 1`)) as any;
    const planId = Number(planRow[0]?.[0]?.id ?? 0);
    if (!planId) continue;
    await db.execute(sql`DELETE FROM scheduleBlocks WHERE planId = ${planId} AND notes LIKE 'forward_planner_source=vitest_%'`);
  }
});

afterAll(async () => {
  const db = getDb();
  for (const d of FUTURE_DATES) {
    const planRow = (await db.execute(sql`SELECT id FROM dailyPlans WHERE date = ${d} LIMIT 1`)) as any;
    const planId = Number(planRow[0]?.[0]?.id ?? 0);
    if (!planId) continue;
    await db.execute(sql`DELETE FROM scheduleBlocks WHERE planId = ${planId}`);
    await db.execute(sql`DELETE FROM dailyPlans WHERE id = ${planId}`);
  }
});

function rowsForTest() {
  return TEST_TOPIC_IDS.map((id, idx) => ({
    date: FUTURE_DATES[idx % FUTURE_DATES.length],
    weekday: 1,
    slotIndex: idx,
    subject: ["Math", "ELA", "Science"][idx % 3],
    topicId: id,
    code: `T-${id}`,
    title: `Test topic ${id}`,
    evidence: `note ${id}`,
    isBlockerFrontload: idx === 0,
  }));
}

describe("applyForwardPlan", () => {
  it("creates one block per (date, topicId), increments perDate, and stamps blocker prefix", async () => {
    const rows = rowsForTest();
    const result = await applyForwardPlan(rows, { source: "vitest_2026-05-17" });
    expect(result.created).toBe(rows.length);
    expect(result.skipped).toBe(0);
    let total = 0;
    for (const v of Object.values(result.perDate)) total += v as number;
    expect(total).toBe(rows.length);

    // Inline check while rows still exist: blocker (idx=0) carries sparkle + isBlocker=1.
    const db = getDb();
    const blockerTopicId = TEST_TOPIC_IDS[0];
    const row = (await db.execute(sql`
      SELECT title, notes FROM scheduleBlocks
       WHERE curriculumTopicId = ${blockerTopicId}
       ORDER BY id DESC LIMIT 1
    `)) as any;
    const r = (row[0] || [])[0];
    expect(r).toBeTruthy();
    expect(String(r.title || "")).toMatch(/^✨/);
    expect(String(r.notes || "")).toContain("isBlocker=1");
  });

  it("is idempotent — re-applying the same rows skips, never duplicates", async () => {
    const rows = rowsForTest();
    const second = await applyForwardPlan(rows, { source: "vitest_2026-05-17" });
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(rows.length);
  });

  it("each created block carries curriculumTopicId + a forward_planner notes tag", async () => {
    const db = getDb();
    for (const id of TEST_TOPIC_IDS) {
      const row = (await db.execute(sql`
        SELECT curriculumTopicId, notes FROM scheduleBlocks
         WHERE curriculumTopicId = ${id}
         ORDER BY id DESC LIMIT 1
      `)) as any;
      const r = (row[0] || [])[0];
      expect(r).toBeTruthy();
      expect(Number(r.curriculumTopicId)).toBe(id);
      expect(String(r.notes || "")).toContain("forward_planner_source=");
    }
  });

});
