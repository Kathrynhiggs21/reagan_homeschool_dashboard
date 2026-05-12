import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { scheduleBlocks } from "../drizzle/schema";
import * as dbMod from "./db";

/**
 * Slice 4 push 10 (2026-05-12)
 *   BUG: "start-time (timeline) edits don't save in manual grid"
 *
 * The frontend (AgendaEditor.tsx → DraggableBlockRow.onBlur) calls
 *   blockUpdateM.mutate({ id, startTime: "13:00" })
 * which lands in the blocks.update tRPC procedure (familyAdminProcedure)
 * which builds a patch and calls db.updateBlock(id, patch).
 *
 * This test exercises db.updateBlock directly with a real DB row to
 * prove the round-trip works at the persistence layer. Any regression
 * here means we've broken the contract the frontend depends on.
 *
 * Edge cases covered:
 *   1. startTime "HH:MM" → persists
 *   2. startTime null → clears the column
 *   3. startTime change does NOT clobber unrelated fields
 *   4. The day-log auto-sync trigger fires (already covered in
 *      dayLogAutoSync.test.ts; here we just make sure updateBlock
 *      doesn't throw when the plan lookup is best-effort).
 */

const PLAN_DATE = "2030-09-09"; // far-future, no production rows

let createdPlanId: number = 0;
let createdBlockId: number = 0;

async function cleanFutureDate() {
  const db = (dbMod as any).getDb();
  // delete blocks for the plan first (FK)
  if (createdPlanId) {
    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, createdPlanId));
  }
}

beforeAll(async () => {
  // Create a brand-new plan for the future date.
  const plan = await dbMod.ensurePlanForDate(PLAN_DATE, "full" as any, {
    allowWeekendAutoBuild: true,
  } as any);
  if (!plan) throw new Error("could not ensure plan for " + PLAN_DATE);
  createdPlanId = (plan as any).id;
  await cleanFutureDate();

  // Insert one block with a known startTime.
  createdBlockId = (await dbMod.createBlock({
    planId: createdPlanId,
    blockType: "custom" as any,
    subjectId: null,
    title: "Push-10 startTime round-trip test block",
    description: null,
    durationMin: 30,
    startTime: "09:00",
    sortOrder: 1,
    status: "not_started" as any,
    curriculumTopicId: null,
  } as any)) as number;
});

afterAll(async () => {
  try {
    await cleanFutureDate();
  } catch {
    /* ignore */
  }
});

async function readBlock(id: number) {
  const db = (dbMod as any).getDb();
  const rows = await db
    .select()
    .from(scheduleBlocks)
    .where(eq(scheduleBlocks.id, id))
    .limit(1);
  return rows[0];
}

describe("Slice 4 push 10 — block.startTime round-trip", () => {
  it("seed block has startTime='09:00'", async () => {
    const blk = await readBlock(createdBlockId);
    expect(blk).toBeTruthy();
    expect(blk.startTime).toBe("09:00");
  });

  it("updateBlock(id, { startTime: '13:30' }) persists and reads back '13:30'", async () => {
    await dbMod.updateBlock(createdBlockId, { startTime: "13:30" } as any);
    const blk = await readBlock(createdBlockId);
    expect(blk.startTime).toBe("13:30");
    // Make sure other fields were not clobbered
    expect(blk.title).toBe("Push-10 startTime round-trip test block");
    expect(blk.durationMin).toBe(30);
    expect(blk.status).toBe("not_started");
  });

  it("updateBlock(id, { startTime: null }) clears the column", async () => {
    await dbMod.updateBlock(createdBlockId, { startTime: null } as any);
    const blk = await readBlock(createdBlockId);
    expect(blk.startTime).toBeNull();
  });

  it("updateBlock with multiple fields including startTime preserves them all", async () => {
    await dbMod.updateBlock(createdBlockId, {
      startTime: "08:15",
      durationMin: 45,
      title: "Updated title",
    } as any);
    const blk = await readBlock(createdBlockId);
    expect(blk.startTime).toBe("08:15");
    expect(blk.durationMin).toBe(45);
    expect(blk.title).toBe("Updated title");
  });

  it("updateBlock idempotency: setting same startTime twice yields same value", async () => {
    await dbMod.updateBlock(createdBlockId, { startTime: "10:00" } as any);
    await dbMod.updateBlock(createdBlockId, { startTime: "10:00" } as any);
    const blk = await readBlock(createdBlockId);
    expect(blk.startTime).toBe("10:00");
  });
});
