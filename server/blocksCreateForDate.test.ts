import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

const ownerOpenId = process.env.OWNER_OPEN_ID || "manus-ci";
const ctx = { user: { openId: ownerOpenId, role: "owner" as const, name: "ci", id: 1, email: "spear.cpt@gmail.com" } };
const caller = appRouter.createCaller(ctx as any);

describe("blocks.createForDate (Agenda Editor + Add block)", () => {
  it("creates a new block on a fresh date with sensible defaults", async () => {
    // Pick a far-future weekday to avoid colliding with anything else.
    const target = "2027-09-13"; // Monday
    const before = await db.getPlanByDate(target);
    const beforeBlocks = before ? await db.listBlocksForPlan(before.id) : [];

    const r = await caller.blocks.createForDate({
      date: target,
      title: "Vitest add block",
      blockType: "custom" as any,
      durationMin: 25,
      startTime: "09:00",
    });

    expect(r).toBeTruthy();
    expect(typeof r.planId).toBe("number");
    expect(typeof r.id === "number" || typeof r.id === "bigint").toBe(true);

    const after = await db.listBlocksForPlan(r.planId);
    // ensurePlanForDate may auto-seed default blocks for a fresh plan;
    // we only require the new block to appear, not an exact count.
    expect(after.length).toBeGreaterThanOrEqual(beforeBlocks.length + 1);
    const created: any = after.find((b: any) => b.title === "Vitest add block");
    expect(created).toBeTruthy();
    expect(created.durationMin).toBe(25);
    expect(created.startTime).toBe("09:00");
    expect(created.blockType).toBe("custom");

    // cleanup
    try { await db.deleteBlock(created.id); } catch {}
  });

  it("rejects malformed date", async () => {
    await expect(
      caller.blocks.createForDate({ date: "not-a-date" } as any)
    ).rejects.toThrow();
  });

  it("rejects out-of-range duration", async () => {
    await expect(
      caller.blocks.createForDate({ date: "2027-09-14", durationMin: 999 } as any)
    ).rejects.toThrow();
  });
});
