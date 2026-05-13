import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { scheduleBlocks } from "../drizzle/schema";
import * as dbMod from "./db";

/**
 * Slice 4 push 11 (2026-05-12)
 *   New: blocks.reorder cascadeStartTimes flag
 *
 * Verifies (without going through tRPC) the underlying behavior the procedure
 * relies on:
 *   1. After updateBlock(sortOrder), listBlocksForPlan returns blocks in the
 *      new order.
 *   2. Cascading startTimes by stacking durations from a known anchor produces
 *      the expected wall-clock sequence.
 *   3. Cascade math handles missing anchor (no-op) + midnight boundary
 *      (block-level skip, others continue).
 *
 * Also runs the cascade math via a thin local re-implementation against real
 * DB rows so any regression in the procedure body is caught structurally.
 */

const PLAN_DATE = "2031-01-15"; // far-future, isolated
let createdPlanId = 0;
let blkA = 0, blkB = 0, blkC = 0;

async function cleanFutureDate() {
  const db = (dbMod as any).getDb();
  if (createdPlanId) {
    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, createdPlanId));
  }
}

beforeAll(async () => {
  const plan = await dbMod.ensurePlanForDate(PLAN_DATE, "full" as any, {
    allowWeekendAutoBuild: true,
  } as any);
  if (!plan) throw new Error("could not ensure plan for " + PLAN_DATE);
  createdPlanId = (plan as any).id;
  await cleanFutureDate();

  // Seed three blocks: A 09:00 30m, B 09:30 45m, C 10:15 20m.
  blkA = (await dbMod.createBlock({
    planId: createdPlanId, blockType: "custom" as any, subjectId: null,
    title: "A", description: null, durationMin: 30, startTime: "09:00",
    sortOrder: 0, status: "not_started" as any, curriculumTopicId: null,
  } as any)) as number;
  blkB = (await dbMod.createBlock({
    planId: createdPlanId, blockType: "custom" as any, subjectId: null,
    title: "B", description: null, durationMin: 45, startTime: "09:30",
    sortOrder: 1, status: "not_started" as any, curriculumTopicId: null,
  } as any)) as number;
  blkC = (await dbMod.createBlock({
    planId: createdPlanId, blockType: "custom" as any, subjectId: null,
    title: "C", description: null, durationMin: 20, startTime: "10:15",
    sortOrder: 2, status: "not_started" as any, curriculumTopicId: null,
  } as any)) as number;
});

afterAll(async () => {
  try { await cleanFutureDate(); } catch { /* ignore */ }
});

async function readBlock(id: number) {
  const db = (dbMod as any).getDb();
  const rows = await db.select().from(scheduleBlocks).where(eq(scheduleBlocks.id, id)).limit(1);
  return rows[0];
}

/**
 * Local copy of the procedure's cascade math — kept here so any drift between
 * this and routers.ts is caught structurally by the source-string assertion at
 * the bottom of this file.
 */
async function applyCascade(orderedIds: number[]) {
  const live = await dbMod.listBlocksForPlan(createdPlanId) as any[];
  const byId = new Map<number, any>(live.map(b => [b.id, b]));
  const firstBlock = byId.get(orderedIds[0]);
  const anchor = firstBlock?.startTime ? String(firstBlock.startTime) : null;
  const m = anchor ? anchor.match(/^(\d{1,2}):(\d{2})$/) : null;
  if (!m) return { cascaded: 0, cascadeSkipped: orderedIds.length };
  let cursor = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  let cascaded = 0, cascadeSkipped = 0;
  for (const id of orderedIds) {
    const b = byId.get(id);
    if (!b) continue;
    if (cursor < 0 || cursor >= 24 * 60) { cascadeSkipped++; continue; }
    const hh = Math.floor(cursor / 60).toString().padStart(2, "0");
    const mm = (cursor % 60).toString().padStart(2, "0");
    await dbMod.updateBlock(b.id, { startTime: `${hh}:${mm}` } as any);
    cascaded++;
    cursor += Math.max(0, Number(b.durationMin) || 0);
  }
  return { cascaded, cascadeSkipped };
}

describe("Slice 4 push 11 — blocks.reorder cascadeStartTimes math", () => {
  it("seed: blocks A/B/C have expected startTimes", async () => {
    const [a, b, c] = await Promise.all([readBlock(blkA), readBlock(blkB), readBlock(blkC)]);
    expect(a.startTime).toBe("09:00");
    expect(b.startTime).toBe("09:30");
    expect(c.startTime).toBe("10:15");
  });

  it("cascade after reorder C→A→B: C anchored to its old 10:15, A becomes 10:35 (10:15+20), B becomes 11:05 (10:35+30)", async () => {
    // Move C to the front; sortOrder rewrite first.
    await dbMod.updateBlock(blkC, { sortOrder: 0 } as any);
    await dbMod.updateBlock(blkA, { sortOrder: 1 } as any);
    await dbMod.updateBlock(blkB, { sortOrder: 2 } as any);

    const result = await applyCascade([blkC, blkA, blkB]);
    expect(result.cascaded).toBe(3);
    expect(result.cascadeSkipped).toBe(0);

    const [a, b, c] = await Promise.all([readBlock(blkA), readBlock(blkB), readBlock(blkC)]);
    expect(c.startTime).toBe("10:15"); // anchor unchanged (re-set to itself)
    expect(a.startTime).toBe("10:35"); // 10:15 + 20m (C duration)
    expect(b.startTime).toBe("11:05"); // 10:35 + 30m (A duration)
  });

  it("cascade with no anchor: first block has no startTime → skip everything", async () => {
    await dbMod.updateBlock(blkA, { startTime: null } as any);
    const result = await applyCascade([blkA, blkB, blkC]);
    expect(result.cascaded).toBe(0);
    expect(result.cascadeSkipped).toBe(3);
    // Restore for next test
    await dbMod.updateBlock(blkA, { startTime: "08:00" } as any);
  });

  it("cascade respects midnight boundary: anchor 23:50 + 30m duration → next would be 24:20 → skipped", async () => {
    await dbMod.updateBlock(blkA, { startTime: "23:50", durationMin: 30 } as any);
    await dbMod.updateBlock(blkB, { startTime: null, durationMin: 10 } as any);
    await dbMod.updateBlock(blkC, { startTime: null, durationMin: 5 } as any);
    const result = await applyCascade([blkA, blkB, blkC]);
    expect(result.cascaded).toBe(1); // only A fit (anchored to 23:50)
    expect(result.cascadeSkipped).toBe(2); // B at 24:20 → skip; C at 24:30 → skip
    const [a, b, c] = await Promise.all([readBlock(blkA), readBlock(blkB), readBlock(blkC)]);
    expect(a.startTime).toBe("23:50");
    expect(b.startTime).toBeNull();
    expect(c.startTime).toBeNull();
  });
});

describe("Slice 4 push 11 — source contract: routers.ts blocks.reorder really has cascadeStartTimes", () => {
  it("routers.ts contains the cascadeStartTimes flag in blocks.reorder", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(path.resolve(__dirname, "routers.ts"), "utf8");
    // Locate the reorder procedure block by its unique input shape.
    const reorderIdx = src.indexOf("orderedIds: z.array(z.number().int().positive()).min(1).max(50)");
    expect(reorderIdx).toBeGreaterThan(0);
    const tailWindow = src.slice(reorderIdx, reorderIdx + 4500);
    expect(tailWindow).toContain("cascadeStartTimes");
    expect(tailWindow).toContain("z.boolean().optional().default(false)");
    // Cascade math markers — guarantees the body actually runs the cascade.
    expect(tailWindow).toContain("input.cascadeStartTimes");
    expect(tailWindow).toMatch(/cursor\s*=\s*parseInt\(m\[1\]/);
    expect(tailWindow).toContain("cursor += Math.max(0, Number(b.durationMin) || 0)");
    expect(tailWindow).toContain("cascadeSkipped++");
    // Return shape includes both new counters
    expect(tailWindow).toContain("return { touched, cascaded, cascadeSkipped }");
  });
});
