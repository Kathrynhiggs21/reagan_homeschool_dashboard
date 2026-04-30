import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, createBlock, moveBlock, listBlocksForPlan, deleteBlock } from "./db";
import { dailyPlans } from "../drizzle/schema";

describe("db.moveBlock — up/down swap", () => {
  let planId = 0;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const db = getDb();
    const existing: any[] = await db.select().from(dailyPlans).where((await import("drizzle-orm")).eq(dailyPlans.date, "2099-12-31" as any));
    if (existing.length > 0) {
      planId = existing[0].id;
      // wipe previous vitest blocks for this plan
      const prior = await listBlocksForPlan(planId);
      for (const p of prior) {
        try { await deleteBlock((p as any).id); } catch {}
      }
    } else {
      const r: any = await db.insert(dailyPlans).values({
        date: "2099-12-31",
        notes: "__vitest_move",
      } as any);
      planId = r[0]?.insertId ?? 0;
    }

    for (let i = 0; i < 3; i++) {
      const id = await createBlock({
        planId,
        blockType: "custom",
        title: `__vitest_move block ${i}`,
        sortOrder: i,
      } as any);
      createdIds.push(id);
    }
  }, 30_000);

  afterAll(async () => {
    for (const id of createdIds) {
      try {
        await deleteBlock(id);
      } catch {}
    }
  });

  it("moves a middle block up to swap with the first", async () => {
    const before = await listBlocksForPlan(planId);
    const middle = before[1];
    const r = await moveBlock((middle as any).id, "up");
    expect(r.ok).toBe(true);

    const after = await listBlocksForPlan(planId);
    expect((after[0] as any).id).toBe((middle as any).id);
  });

  it("returns ok:false when moving the first block up", async () => {
    const before = await listBlocksForPlan(planId);
    const r = await moveBlock((before[0] as any).id, "up");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/edge/);
  });
});
