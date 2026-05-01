import { describe, it, expect, afterAll } from "vitest";
import * as db from "./db";
import { dailyPlans, scheduleBlocks } from "../drizzle/schema";
import { sql, eq } from "drizzle-orm";

describe("today.refresh", () => {
  // Pick a far-future Tuesday so we hit the "full" template
  const DATE = "2099-04-14"; // Tuesday

  afterAll(async () => {
    const drizzle = (db as any).getDb?.();
    const plans = await drizzle.select().from(dailyPlans).where(eq(dailyPlans.date as any, DATE as any));
    for (const p of plans as any[]) {
      await drizzle.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, p.id));
    }
    await drizzle.execute(sql`DELETE FROM dailyPlans WHERE date = ${DATE}`);
  });

  it("creates a plan + at least 5 blocks if none exists", async () => {
    const r = await db.refreshTodayPlan({ dateStr: DATE });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Either added now, or created by ensurePlanForDate (kept) — the union must be >= 5.
      expect(r.added + r.kept).toBeGreaterThanOrEqual(5);
    }
  });

  it("preserves a completed block when called a second time", async () => {
    const drizzle = (db as any).getDb?.();
    const plans = await drizzle.select().from(dailyPlans).where(eq(dailyPlans.date as any, DATE as any));
    const planId = plans[0].id;
    // Mark one block completed.
    const blocks = await drizzle.select().from(scheduleBlocks).where(eq(scheduleBlocks.planId, planId));
    expect(blocks.length).toBeGreaterThan(0);
    await drizzle.update(scheduleBlocks).set({ status: "complete" as any }).where(eq(scheduleBlocks.id, blocks[0].id));
    const completedTitle = blocks[0].title;
    // Refresh again.
    const r = await db.refreshTodayPlan({ dateStr: DATE });
    expect(r.ok).toBe(true);
    // Completed block should still be present.
    const after = await drizzle.select().from(scheduleBlocks).where(eq(scheduleBlocks.planId, planId));
    const stillThere = (after as any[]).find((b) => b.title === completedTitle && b.status === "complete");
    expect(stillThere).toBeTruthy();
  });
});
