/**
 * Integration tests for the Idea Library DB helpers (2026-06-19).
 *
 * Locked behaviors:
 *   1. listAdventuresFiltered with no args returns the full bank.
 *   2. Filtering by kind narrows to only that kind.
 *   3. Filtering by wishlistStatus narrows to only that status.
 *   4. setAdventureStatus moves a row through the pipeline and persists.
 *   5. addAdventureToDay creates a real `adventure` scheduleBlocks row on the
 *      resolved plan, linked via adventureId, appended at the end.
 */
import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import * as db from "./db";
import { scheduleBlocks } from "../drizzle/schema";

const FUTURE_DATE = "2098-07-15"; // isolated from other integration tests

async function pickAdventureId(): Promise<number> {
  const all = (await db.listAdventuresFiltered()) as any[];
  if (all.length === 0) throw new Error("no adventures seeded");
  return all[0].id;
}

afterAll(async () => {
  try {
    const d = (db as any).getDb();
    const plan = await db.getPlanByDate(FUTURE_DATE);
    if (plan) {
      await d.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, plan.id));
    }
  } catch {}
});

describe("Idea Library helpers", () => {
  it("listAdventuresFiltered() returns the full bank", async () => {
    const all = (await db.listAdventuresFiltered()) as any[];
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  it("filters by kind", async () => {
    const modules = (await db.listAdventuresFiltered({ kind: "module" })) as any[];
    // Every returned row must be of the requested kind.
    for (const m of modules) expect(m.kind).toBe("module");
  });

  it("filters by wishlistStatus", async () => {
    const ideas = (await db.listAdventuresFiltered({ wishlistStatus: "idea" })) as any[];
    for (const i of ideas) expect(i.wishlistStatus).toBe("idea");
  });

  it("setAdventureStatus persists the new status", async () => {
    const id = await pickAdventureId();
    const before = await db.getAdventure(id);
    const original = (before as any)?.wishlistStatus ?? "idea";

    const updated = await db.setAdventureStatus(id, "want_to_do");
    expect((updated as any)?.wishlistStatus).toBe("want_to_do");

    const done = await db.setAdventureStatus(id, "done");
    expect((done as any)?.wishlistStatus).toBe("done");

    // restore
    await db.setAdventureStatus(id, original);
  });

  it("addAdventureToDay creates a linked adventure block at the end", async () => {
    const id = await pickAdventureId();
    const res = await db.addAdventureToDay({
      adventureId: id,
      date: FUTURE_DATE,
      durationMin: 45,
    });
    expect(res.blockId).toBeGreaterThan(0);
    expect(res.planId).toBeGreaterThan(0);

    const d = (db as any).getDb();
    const rows = await d
      .select()
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.id, res.blockId))
      .limit(1);
    const block = rows[0];
    expect(block).toBeTruthy();
    expect(block.blockType).toBe("adventure");
    expect(block.adventureId).toBe(id);
    expect(block.durationMin).toBe(45);
    expect(block.planId).toBe(res.planId);

    // A second add should append after the first (higher sortOrder).
    const res2 = await db.addAdventureToDay({ adventureId: id, date: FUTURE_DATE });
    const rows2 = await d
      .select()
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.id, res2.blockId))
      .limit(1);
    expect(rows2[0].sortOrder).toBeGreaterThan(block.sortOrder);
  });
});
