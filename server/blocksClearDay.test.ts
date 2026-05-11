/**
 * Slice 3 — blocks.clearDay
 *
 * The "Design today from blank" button on AgendaEditor calls this. It must:
 *   1. Ensure a plan exists for the date (so a future re-build has somewhere
 *      to attach blocks to).
 *   2. Delete every block on that plan.
 *   3. Return { planId, deleted } so the UI can show a confirm toast.
 *   4. Be safe to call again (idempotent — second call returns deleted=0).
 */
import { describe, it, expect } from "vitest";
import {
  ensurePlanForDate,
  deleteBlocksForPlan,
  listBlocksForPlan,
  createBlock,
} from "./db";

function uniqueDate(): string {
  // Pick a far-future weekday so other tests can't collide.
  const d = new Date();
  d.setDate(d.getDate() + 600 + Math.floor(Math.random() * 30));
  // Force to a Tuesday so weekend-rule never short-circuits.
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

describe("Slice 3 — blocks.clearDay (deleteBlocksForPlan)", () => {
  it("deletes every block on the plan and returns the count", async () => {
    const date = uniqueDate();
    const plan = await ensurePlanForDate(date, "full", { allowWeekendAutoBuild: false } as any);
    expect(plan).toBeTruthy();
    if (!plan) return;

    // Seed three blocks so we have something to clear.
    await createBlock({ planId: plan.id, blockType: "math", title: "Test math", durationMin: 25, sortOrder: 0 } as any);
    await createBlock({ planId: plan.id, blockType: "read_aloud", title: "Test reading", durationMin: 20, sortOrder: 1 } as any);
    await createBlock({ planId: plan.id, blockType: "adventure", title: "Test adventure", durationMin: 30, sortOrder: 2 } as any);

    const before = await listBlocksForPlan(plan.id);
    expect(before.length).toBeGreaterThanOrEqual(3);

    const deleted = await deleteBlocksForPlan(plan.id);
    expect(deleted).toBeGreaterThanOrEqual(3);

    const after = await listBlocksForPlan(plan.id);
    expect(after.length).toBe(0);
  });

  it("is idempotent — calling clear twice returns 0 the second time", async () => {
    const date = uniqueDate();
    const plan = await ensurePlanForDate(date, "full", { allowWeekendAutoBuild: false } as any);
    expect(plan).toBeTruthy();
    if (!plan) return;

    await createBlock({ planId: plan.id, blockType: "math", title: "Solo block", durationMin: 25, sortOrder: 0 } as any);

    const first = await deleteBlocksForPlan(plan.id);
    expect(first).toBeGreaterThanOrEqual(1);

    const second = await deleteBlocksForPlan(plan.id);
    expect(second).toBe(0);
  });

  it("preserves the plan row itself (so re-build can reuse the same planId)", async () => {
    const date = uniqueDate();
    const plan = await ensurePlanForDate(date, "full", { allowWeekendAutoBuild: false } as any);
    expect(plan).toBeTruthy();
    if (!plan) return;

    await createBlock({ planId: plan.id, blockType: "math", title: "X", durationMin: 25, sortOrder: 0 } as any);
    await deleteBlocksForPlan(plan.id);

    // Ensure-again should return the SAME plan id, not create a new one.
    const again = await ensurePlanForDate(date, "full", { allowWeekendAutoBuild: false } as any);
    expect(again?.id).toBe(plan.id);
  });
});
