import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb } from "./db";

/**
 * Real-DB integration test for curriculum.forwardPlan.preview + applyPlan.
 *
 * - Adult ctx: hits the familyAdmin gate.
 * - Future plan dates so we don't collide with real homeschool data.
 * - After: clean up everything we created.
 */

const ctxAdult = {
  user: {
    openId: process.env.OWNER_OPEN_ID || "manus-ci",
    role: "admin" as const,
    name: "ci",
    id: 1,
    email: "spear.cpt@gmail.com",
  },
};
const caller = appRouter.createCaller(ctxAdult as any);

// Pick a Monday far in the future.
const FUTURE_MONDAY = "2027-09-13";

afterAll(async () => {
  const db = getDb();
  // Clean up any plans + blocks created at FUTURE_MONDAY .. +14 days.
  for (let i = 0; i < 14; i++) {
    const d = new Date(FUTURE_MONDAY + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const planRow = (await db.execute(
      sql`SELECT id FROM dailyPlans WHERE date = ${iso} LIMIT 1`,
    )) as any;
    const planId = Number(planRow[0]?.[0]?.id ?? 0);
    if (!planId) continue;
    await db.execute(
      sql`DELETE FROM scheduleBlocks WHERE planId = ${planId} AND notes LIKE 'forward_planner_source=vitest_%'`,
    );
    // Only delete the dailyPlans row if no blocks remain (don't clobber real data).
    const remain = (await db.execute(
      sql`SELECT COUNT(*) AS n FROM scheduleBlocks WHERE planId = ${planId}`,
    )) as any;
    const n = Number(remain[0]?.[0]?.n ?? 0);
    if (n === 0) {
      await db.execute(sql`DELETE FROM dailyPlans WHERE id = ${planId}`);
    }
  }
});

describe("curriculum.forwardPlan", () => {
  it("preview returns rows + per-subject counts for the adult", async () => {
    const out = await caller.curriculum.forwardPlan.preview({
      startDate: FUTURE_MONDAY,
      horizonDays: 5,
    });
    expect(out.startDate).toBe(FUTURE_MONDAY);
    expect(out.horizonDays).toBe(5);
    expect(Array.isArray(out.rows)).toBe(true);
    // We've got 23 unfinished topics; preview should propose at least a handful.
    expect(out.rows.length).toBeGreaterThan(0);
    const sumPerSubject = Object.values(out.perSubject).reduce(
      (a: number, b: number) => a + b,
      0,
    );
    expect(sumPerSubject).toBe(out.rows.length);
  });

  it("preview is gated to familyAdmin (kid ctx is rejected)", async () => {
    const ctxKid = {
      user: {
        openId: "kid-open-id",
        role: "user" as const,
        name: "Reagan",
        id: 2,
        email: "kid@example.com",
      },
    };
    const kidCaller = appRouter.createCaller(ctxKid as any);
    let threw = false;
    try {
      await kidCaller.curriculum.forwardPlan.preview({
        startDate: FUTURE_MONDAY,
        horizonDays: 5,
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("applyPlan creates blocks for the previewed rows + perDate roll-up", async () => {
    const preview = await caller.curriculum.forwardPlan.preview({
      startDate: FUTURE_MONDAY,
      horizonDays: 3,
    });
    // Take a small slice so the test stays fast.
    const slice = preview.rows.slice(0, 5);
    expect(slice.length).toBeGreaterThan(0);

    const applied = await caller.curriculum.forwardPlan.applyPlan({
      rows: slice,
      source: "vitest_2026-05-17",
    });
    expect(applied.created).toBe(slice.length);
    expect(applied.skipped).toBe(0);

    let total = 0;
    for (const v of Object.values(applied.perDate)) total += v as number;
    expect(total).toBe(slice.length);

    // Re-running is idempotent.
    const second = await caller.curriculum.forwardPlan.applyPlan({
      rows: slice,
      source: "vitest_2026-05-17",
    });
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(slice.length);
  });
});
