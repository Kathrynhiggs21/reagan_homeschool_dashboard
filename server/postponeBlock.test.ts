import { describe, it, expect } from "vitest";
import {
  ensurePlanForDate,
  createBlock,
  listBlocksForPlan,
  getBlock,
  updateBlock,
  getDb,
} from "./db";
import { dailyPlans } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Postpone-block path test:
 * The adultAi.postponeBlock mutation is exercised at the router layer in
 * production, but its DB path is a single updateBlock({planId: <new plan>})
 * call. This test verifies that re-parenting a block to a different plan
 * (i.e. moving it to "tomorrow") successfully removes it from the original
 * plan's listBlocksForPlan() result and adds it to the target plan's.
 */
describe("postpone-block (move to tomorrow)", () => {
  it("re-parents a block from one plan to another and updates listings", async () => {
    const db = getDb();
    const today = "2099-09-09";
    const tomorrow = "2099-09-10";

    // Make sure the test rows are clean (idempotent).
    await db.delete(dailyPlans).where(eq(dailyPlans.date as any, today as any));
    await db.delete(dailyPlans).where(eq(dailyPlans.date as any, tomorrow as any));

    const plan1 = await ensurePlanForDate(today, "off", { allowWeekendAutoBuild: false });
    const plan2 = await ensurePlanForDate(tomorrow, "off", { allowWeekendAutoBuild: false });
    if (!plan1 || !plan2) throw new Error("plans not created");

    await createBlock({
      planId: plan1.id,
      blockType: "custom",
      title: "Move-test block",
      durationMin: 30,
      sortOrder: 0,
    });

    const before1 = await listBlocksForPlan(plan1.id);
    const before2 = await listBlocksForPlan(plan2.id);
    const target = before1.find((b) => b.title === "Move-test block");
    expect(target).toBeTruthy();
    expect(before2.find((b) => b.title === "Move-test block")).toBeUndefined();

    // Mirror exactly what adultAi.postponeBlock does.
    await updateBlock(target!.id, { planId: plan2.id, status: "not_started" } as any);

    const moved = await getBlock(target!.id);
    expect(moved?.planId).toBe(plan2.id);

    const after1 = await listBlocksForPlan(plan1.id);
    const after2 = await listBlocksForPlan(plan2.id);
    expect(after1.find((b) => b.id === target!.id)).toBeUndefined();
    expect(after2.find((b) => b.id === target!.id)).toBeTruthy();
  }, 30_000);
});
