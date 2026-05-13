import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

/**
 * Push 19 (2026-05-12): Tutor convenience — `blocks.copyFromDate` mutation.
 * Locks the contract used by the AgendaEditor "Copy yesterday" /
 * "Copy from last Monday" buttons.
 */

const ownerOpenId = process.env.OWNER_OPEN_ID || "manus-ci";
const ctx = { user: { openId: ownerOpenId, role: "owner" as const, name: "ci", id: 1, email: "spear.cpt@gmail.com" } };
const caller = appRouter.createCaller(ctx as any);

const SRC = "2027-09-20"; // far-future Monday so we don't collide
const TGT = "2027-09-21"; // Tuesday
const createdBlockIds: number[] = [];

async function clean(date: string) {
  const plan = await db.getPlanByDate(date);
  if (!plan) return;
  const blocks = await db.listBlocksForPlan((plan as any).id);
  for (const b of blocks as any[]) {
    try { await db.deleteBlock(b.id); } catch {}
  }
}

beforeAll(async () => {
  await clean(SRC);
  await clean(TGT);
});

afterAll(async () => {
  await clean(SRC);
  await clean(TGT);
});

describe("blocks.copyFromDate (push 19)", () => {
  it("returns no-source-plan when source has no plan row at all", async () => {
    // Use a date with no plan row; deletePlan would require a helper, so
    // pick a date well outside any auto-seed window.
    const r: any = await caller.blocks.copyFromDate({
      sourceDate: "2099-01-01",
      targetDate: TGT,
    });
    expect(r.copied).toBe(0);
    // Either no source plan (nothing exists for 2099) or source-empty:
    // both are valid "nothing to copy" outcomes.
    expect(["no-source-plan", "empty-source"]).toContain(r.reason);
  });

  it("rejects same source and target date with same-date reason", async () => {
    const r: any = await caller.blocks.copyFromDate({
      sourceDate: TGT,
      targetDate: TGT,
    });
    expect(r.copied).toBe(0);
    expect(r.reason).toBe("same-date");
  });

  it("copies every block from source onto target with status reset", async () => {
    // Seed source with 2 blocks via createForDate.
    const a = await caller.blocks.createForDate({
      date: SRC, title: "Math warm-up (src)", durationMin: 25, startTime: "09:00", blockType: "custom" as any,
    });
    createdBlockIds.push(Number(a.id));
    const b = await caller.blocks.createForDate({
      date: SRC, title: "Read aloud (src)", durationMin: 30, startTime: "09:30", blockType: "custom" as any,
    });
    createdBlockIds.push(Number(b.id));

    // Mark one of them complete to verify status RESETS on copy.
    await caller.blocks.update({ id: Number(a.id), status: "complete" as any });

    const before = await db.getPlanByDate(TGT);
    const beforeCount = before ? (await db.listBlocksForPlan((before as any).id)).length : 0;

    const r: any = await caller.blocks.copyFromDate({ sourceDate: SRC, targetDate: TGT });
    expect(r.copied).toBeGreaterThanOrEqual(2);
    expect(typeof r.planId).toBe("number");

    const targetPlan = await db.getPlanByDate(TGT);
    const tgtBlocks: any[] = await db.listBlocksForPlan((targetPlan as any).id);
    expect(tgtBlocks.length).toBeGreaterThanOrEqual(beforeCount + 2);

    // Both copied titles must appear on target
    const titles = tgtBlocks.map((x) => x.title);
    expect(titles).toContain("Math warm-up (src)");
    expect(titles).toContain("Read aloud (src)");

    // Status must be reset on every copied block (no green checkmarks
    // inherited).
    const copiedFromA = tgtBlocks.find((x) => x.title === "Math warm-up (src)");
    expect(copiedFromA?.status).toBe("not_started");
    expect(copiedFromA?.completedAt == null).toBe(true);

    // Times + durations preserved.
    expect(copiedFromA?.durationMin).toBe(25);
    expect(copiedFromA?.startTime).toBe("09:00");
  });

  it("appends rather than replacing existing blocks on the target date", async () => {
    // After previous test, target already has the 2 copied + any seeded.
    const beforePlan = await db.getPlanByDate(TGT);
    const beforeCount = beforePlan ? (await db.listBlocksForPlan((beforePlan as any).id)).length : 0;
    const r: any = await caller.blocks.copyFromDate({ sourceDate: SRC, targetDate: TGT });
    expect(r.copied).toBeGreaterThan(0);
    const afterPlan = await db.getPlanByDate(TGT);
    const afterCount = (await db.listBlocksForPlan((afterPlan as any).id)).length;
    expect(afterCount).toBe(beforeCount + r.copied);
  });
});
