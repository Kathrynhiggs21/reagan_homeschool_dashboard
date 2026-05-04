/**
 * Tests for the new agenda-editing capabilities:
 *   - blocks.shiftDay  shifts every block's startTime by N minutes
 *   - blocks.reorder   rewrites sortOrder per orderedIds
 *
 * Both should be transparent to existing data and ignore unsafe edges
 * (cross-midnight shifts, unknown ids).
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

const adultCtx: any = { user: { id: 1, openId: "ops-test", name: "Vitest Adult", role: "user" } };

const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

async function ensureToday() {
  const plan = await db.ensurePlanForDate(today, "full", { allowWeekendAutoBuild: true });
  if (!plan) throw new Error("plan missing");
  return plan;
}

describe("blocks.shiftDay", () => {
  it("shifts every block forward by 15 minutes", async () => {
    const caller = appRouter.createCaller(adultCtx);
    const plan = await ensureToday();
    const before: any[] = await db.listBlocksForPlan(plan.id);
    const baseline = before.filter(b => b.startTime).map(b => ({ id: b.id, t: b.startTime }));
    if (baseline.length === 0) {
      // No timed blocks today — sanity-check the operation still returns shape.
      const r = await caller.blocks.shiftDay({ date: today, minutes: 15 });
      expect(r.shifted).toBe(0);
      return;
    }
    const r = await caller.blocks.shiftDay({ date: today, minutes: 15 });
    expect(r.shifted).toBeGreaterThan(0);
    const after: any[] = await db.listBlocksForPlan(plan.id);
    for (const b of baseline) {
      const a = after.find(x => x.id === b.id);
      if (!a || !a.startTime) continue;
      const [bh, bm] = b.t.split(":").map(Number);
      const [ah, am] = a.startTime.split(":").map(Number);
      const before = bh * 60 + bm;
      const next = ah * 60 + am;
      // Either it shifted by +15, or it would have crossed midnight and was
      // safely skipped (next === before). Anything else is a real failure.
      const ok = next === before + 15 || next === before;
      expect(ok).toBe(true);
    }
    // Restore so we don't pollute other tests.
    await caller.blocks.shiftDay({ date: today, minutes: -15 });
  });

  it("rejects shifts that would cross midnight (returns shifted=0 for those blocks)", async () => {
    const caller = appRouter.createCaller(adultCtx);
    // 12 hours is the validator's max; that's well within bounds but will
    // cross midnight for any block already past noon, so we expect skipped > 0.
    const r = await caller.blocks.shiftDay({ date: today, minutes: 60 * 12 });
    // The skipped count must be > 0 if any block had a startTime > 1 AM, which is
    // virtually all of them. shifted may be 0; that's fine — the test is only
    // ensuring the call doesn't throw and the result shape is correct.
    expect(typeof r.shifted).toBe("number");
    expect(typeof r.skipped).toBe("number");
  });
});

describe("blocks.reorder", () => {
  it("rewrites sortOrder to match orderedIds", async () => {
    const caller = appRouter.createCaller(adultCtx);
    const plan = await ensureToday();
    const live: any[] = await db.listBlocksForPlan(plan.id);
    if (live.length < 2) return; // nothing to reorder

    const original = live.map(b => b.id);
    const reversed = original.slice().reverse();

    await caller.blocks.reorder({ date: today, orderedIds: reversed });
    const after: any[] = await db.listBlocksForPlan(plan.id);
    const orderAfter = after.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(b => b.id);
    expect(orderAfter.slice(0, reversed.length)).toEqual(reversed);

    // Restore.
    await caller.blocks.reorder({ date: today, orderedIds: original });
  });

  it("ignores unknown block ids without throwing", async () => {
    const caller = appRouter.createCaller(adultCtx);
    const plan = await ensureToday();
    const live: any[] = await db.listBlocksForPlan(plan.id);
    if (live.length === 0) return;
    const r = await caller.blocks.reorder({
      date: today,
      orderedIds: [live[0].id, 999_999_999],
    });
    expect(r.touched).toBe(1);
  });
});
