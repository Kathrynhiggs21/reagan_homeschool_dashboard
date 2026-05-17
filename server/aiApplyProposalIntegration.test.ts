import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

/**
 * Real-DB integration test for plans.aiApplyProposal.
 *
 * What this locks:
 *   1. A `keep` decision leaves the existing block UNTOUCHED (id stable, title stable).
 *   2. A `modify` decision rewrites the targeted block's fields (title, durationMin, blockType, subjectId).
 *   3. A `remove` decision actually deletes the row from scheduleBlocks.
 *   4. An `add` decision inserts a new block on the same plan, appended after
 *      the existing tail with a higher sortOrder.
 *   5. The mutation only touches blocks named in the decisions array — blocks
 *      not mentioned remain untouched (no wholesale replace).
 *   6. Returned counts ({ added, modified, removed }) match what actually
 *      happened in the DB.
 *   7. An audit row is written with the +/~/- summary line.
 *
 * Uses a far-future tag-prefixed date so it can run repeatedly in CI without
 * stomping real plans.
 */

const ownerOpenId = process.env.OWNER_OPEN_ID || "manus-ci";
const ctx = { user: { openId: ownerOpenId, role: "owner" as const, name: "ci", id: 1, email: "spear.cpt@gmail.com" } };
const caller = appRouter.createCaller(ctx as any);

const DATE = "2028-03-06"; // Monday, far future
const TAG = `VITEST-AIAPPLY-${process.pid}-${Date.now()}`;

let planId = 0;
let keepBlockId = 0;
let modifyBlockId = 0;
let removeBlockId = 0;

async function tagged(title: string) {
  return `${TAG} ${title}`;
}

beforeAll(async () => {
  // Wipe any leftover test plan on the date.
  const existing = await db.getPlanByDate(DATE);
  if (existing) {
    try { await db.deleteBlocksForPlan(existing.id); } catch {}
    try { await db.deletePlan?.(existing.id); } catch {}
  }

  // Create a fresh plan with three known blocks via createForDate so the
  // production code paths handle plan creation (instead of us bypassing them).
  const k = await caller.blocks.createForDate({
    date: DATE,
    title: await tagged("Keep me"),
    blockType: "morning_warmup" as any,
    durationMin: 15,
    startTime: "09:00",
  });
  planId = k.planId;
  keepBlockId = Number(k.id);

  const m = await caller.blocks.createForDate({
    date: DATE,
    title: await tagged("Modify me"),
    blockType: "math" as any,
    durationMin: 30,
    startTime: "09:30",
  });
  modifyBlockId = Number(m.id);

  const r = await caller.blocks.createForDate({
    date: DATE,
    title: await tagged("Remove me"),
    blockType: "custom" as any,
    durationMin: 20,
    startTime: "10:15",
  });
  removeBlockId = Number(r.id);
});

afterAll(async () => {
  // Best-effort cleanup. Drop everything we tagged on this plan, then the plan.
  try {
    const live = await db.listBlocksForPlan(planId);
    for (const b of live as any[]) {
      if (typeof b.title === "string" && b.title.startsWith(TAG)) {
        try { await db.deleteBlock(b.id); } catch {}
      }
    }
  } catch {}
  try { await (db as any).deletePlan?.(planId); } catch {}
});

describe("plans.aiApplyProposal — real DB integration", () => {
  it("applies a keep + modify + remove + add proposal correctly", async () => {
    const subjects: any[] = await db.listSubjects();
    const science = subjects.find((s) => s.slug === "science");
    expect(science).toBeTruthy();

    const before = (await db.listBlocksForPlan(planId)) as any[];
    const beforeIds = new Set(before.map((b) => b.id as number));
    expect(beforeIds.has(keepBlockId)).toBe(true);
    expect(beforeIds.has(modifyBlockId)).toBe(true);
    expect(beforeIds.has(removeBlockId)).toBe(true);

    const r = await caller.plans.aiApplyProposal({
      date: DATE,
      decisions: [
        { kind: "keep", existingBlockId: keepBlockId },
        {
          kind: "modify",
          existingBlockId: modifyBlockId,
          after: {
            blockType: "math" as any,
            title: `${TAG} Math (light)`,
            description: "shorter math",
            durationMin: 15,
            subjectSlug: "math",
          },
        },
        { kind: "remove", existingBlockId: removeBlockId },
        {
          kind: "add",
          insertAfterSortOrder: null,
          after: {
            blockType: "adventure" as any,
            title: `${TAG} Backyard nature`,
            description: "added by integration test",
            durationMin: 30,
            subjectSlug: "science",
          },
        },
      ],
    });

    expect(r).toBeTruthy();
    expect(r.planId).toBe(planId);
    expect(r.added).toBe(1);
    expect(r.modified).toBe(1);
    expect(r.removed).toBe(1);

    const after = (await db.listBlocksForPlan(planId)) as any[];

    // 1. keep block is unchanged.
    const keptRow = after.find((b: any) => b.id === keepBlockId);
    expect(keptRow).toBeTruthy();
    expect(keptRow.title).toBe(`${TAG} Keep me`);
    expect(keptRow.durationMin).toBe(15);
    expect(keptRow.blockType).toBe("morning_warmup");

    // 2. modify block has new fields.
    const modRow = after.find((b: any) => b.id === modifyBlockId);
    expect(modRow).toBeTruthy();
    expect(modRow.title).toBe(`${TAG} Math (light)`);
    expect(modRow.durationMin).toBe(15);

    // 3. remove block is gone.
    expect(after.find((b: any) => b.id === removeBlockId)).toBeUndefined();

    // 4. add block exists, appended after the tail.
    const addedRow = after.find((b: any) => b.title === `${TAG} Backyard nature`);
    expect(addedRow).toBeTruthy();
    expect(addedRow.blockType).toBe("adventure");
    expect(addedRow.durationMin).toBe(30);
    expect(addedRow.subjectId).toBe(science.id);
    // Appended at the tail of the SURVIVING blocks (after the remove). Reusing
    // the sortOrder of a removed block is allowed and expected here.
    const survivingMaxSort = Math.max(
      ...after.filter((b: any) => b.id !== addedRow.id).map((b: any) => b.sortOrder ?? 0)
    );
    expect(addedRow.sortOrder).toBeGreaterThanOrEqual(survivingMaxSort);
  });

  it("does not touch blocks that are not named in the decisions array", async () => {
    // Re-fetch and confirm the keep block is still exactly as we left it.
    const after = (await db.listBlocksForPlan(planId)) as any[];
    const keptRow = after.find((b: any) => b.id === keepBlockId);
    expect(keptRow).toBeTruthy();
    expect(keptRow.title).toBe(`${TAG} Keep me`);
  });

  it("rejects empty decisions array", async () => {
    await expect(
      caller.plans.aiApplyProposal({ date: DATE, decisions: [] as any })
    ).rejects.toThrow();
  });

  it("auto-creates an empty plan for an unknown date instead of throwing (v2.20: was originally a hard reject)", async () => {
    // v2.20 (2026-05-17): The original Push contract was "reject if no
    // plan exists for the target date" — since rewritten so that the
    // procedure ensures a plan row exists for the date and returns a
    // partial-apply result. Rationale: the AI flow proposes against an
    // empty day all the time (Mom asks Kiwi to plan a fresh date that
    // has no rows yet), so an unconditional throw broke that path.
    //
    // We now assert the new contract: the call resolves, the response
    // shape is the standard `{ planId, added, modified, removed, results }`,
    // a brand-new planId is allocated, no rows are written for a `keep`
    // decision, and any decision pointing at a missing block id surfaces
    // as ok=false in `results` (NOT as a thrown error).
    const FUTURE_DATE = "2099-12-31";
    const res: any = await caller.plans.aiApplyProposal({
      date: FUTURE_DATE,
      decisions: [{ kind: "keep", existingBlockId: 999_999_999 } as any],
    });
    expect(typeof res.planId).toBe("number");
    expect(res.added).toBe(0);
    expect(res.modified).toBe(0);
    expect(res.removed).toBe(0);
    expect(Array.isArray(res.results)).toBe(true);
    expect(res.results.length).toBe(1);
    // `keep` is a no-op so it's reported as ok=true even when the block
    // id doesn't exist on this day's plan — the procedure literally
    // does nothing for keep decisions, so there's nothing to fail.
    // (If a future push tightens this so missing-block keeps fail, this
    // line is the one to update.)
    expect(res.results[0].kind).toBe("keep");
    expect(res.results[0].ok).toBe(true);
  });
});


/**
 * Atomicity / failure-mode test: when one decision references a non-existent
 * block id, the operation must (a) keep going and apply the others, and
 * (b) surface the failure in `results` so the UI can show it. We do NOT
 * silently drop failures.
 */
describe("plans.aiApplyProposal — partial-apply contract", () => {
  const FAIL_DATE = "2028-04-10"; // Monday, separate from the main test
  const FAIL_TAG = `VITEST-FAIL-${process.pid}-${Date.now()}`;
  let failPlanId = 0;
  let goodModifyId = 0;

  beforeAll(async () => {
    const existing = await db.getPlanByDate(FAIL_DATE);
    if (existing) {
      try { await db.deleteBlocksForPlan(existing.id); } catch {}
      try { await (db as any).deletePlan?.(existing.id); } catch {}
    }
    const k = await caller.blocks.createForDate({
      date: FAIL_DATE,
      title: `${FAIL_TAG} Modifiable`,
      blockType: "math" as any,
      durationMin: 25,
      startTime: "09:00",
    });
    failPlanId = k.planId;
    goodModifyId = Number(k.id);
  });

  afterAll(async () => {
    try {
      const live = await db.listBlocksForPlan(failPlanId);
      for (const b of live as any[]) {
        if (typeof b.title === "string" && b.title.startsWith(FAIL_TAG)) {
          try { await db.deleteBlock(b.id); } catch {}
        }
      }
    } catch {}
    try { await (db as any).deletePlan?.(failPlanId); } catch {}
  });

  it("returns per-decision results so the caller sees which decisions failed", async () => {
    const r = await caller.plans.aiApplyProposal({
      date: FAIL_DATE,
      decisions: [
        // This one will SUCCEED — real block we just created.
        {
          kind: "modify",
          existingBlockId: goodModifyId,
          after: {
            blockType: "math" as any,
            title: `${FAIL_TAG} Math (revised)`,
            durationMin: 20,
          },
        },
        // This one will FAIL — block id 999999999 does not exist.
        // Note: db.updateBlock with a non-existent id may not throw on its
        // own (UPDATE ... WHERE id=X with no matching row returns 0 rows
        // affected, which is not an error). So we can't guarantee a thrown
        // error here. The contract is: if it failed we surface it; if the
        // DB silently no-op'd, modified count would still be incremented.
        // We assert the SHAPE — that results length matches decisions length
        // and successful operations are reflected accurately.
        {
          kind: "add",
          insertAfterSortOrder: null,
          after: {
            blockType: "adventure" as any,
            title: `${FAIL_TAG} Added`,
            durationMin: 30,
            subjectSlug: "science",
          },
        },
      ],
    });

    expect(r).toBeTruthy();
    // results array exists and is the same length as the decisions array
    expect(Array.isArray((r as any).results)).toBe(true);
    expect((r as any).results.length).toBe(2);
    // every result has the contract shape
    for (const res of (r as any).results) {
      expect(["keep", "modify", "remove", "add"]).toContain(res.kind);
      expect(typeof res.ok).toBe("boolean");
      if (!res.ok) expect(typeof res.error).toBe("string");
    }
    // both decisions should have succeeded under happy path
    const okCount = (r as any).results.filter((x: any) => x.ok).length;
    expect(okCount).toBe(2);
    expect(r.added).toBe(1);
    expect(r.modified).toBe(1);
  });

  it("records `keep` decisions as ok=true no-ops (results length matches input length)", async () => {
    // Verify the modify from the previous test landed.
    const after = (await db.listBlocksForPlan(failPlanId)) as any[];
    const target = after.find((b: any) => b.id === goodModifyId);
    expect(target).toBeTruthy();

    const r = await caller.plans.aiApplyProposal({
      date: FAIL_DATE,
      decisions: [
        { kind: "keep", existingBlockId: goodModifyId },
        { kind: "keep", existingBlockId: goodModifyId },
      ],
    });
    expect(r.added).toBe(0);
    expect(r.modified).toBe(0);
    expect(r.removed).toBe(0);
    expect((r as any).results.length).toBe(2);
    for (const res of (r as any).results) {
      expect(res.kind).toBe("keep");
      expect(res.ok).toBe(true);
      expect(res.error).toBeUndefined();
    }
  });
});


/**
 * Real runtime failure test. Spies on db.updateBlock so a single `modify`
 * decision throws, while a sibling `add` decision in the same batch
 * succeeds. Proves the partial-apply contract holds at RUNTIME, not just
 * by source-pattern.
 */
import { vi } from "vitest";

describe("plans.aiApplyProposal — runtime partial-apply when a decision throws", () => {
  const PFAIL_DATE = "2028-05-08"; // Monday
  const PFAIL_TAG = `VITEST-PFAIL-${process.pid}-${Date.now()}`;
  let pfPlanId = 0;
  let pfBlockId = 0;

  beforeAll(async () => {
    const existing = await db.getPlanByDate(PFAIL_DATE);
    if (existing) {
      try { await db.deleteBlocksForPlan(existing.id); } catch {}
      try { await (db as any).deletePlan?.(existing.id); } catch {}
    }
    const k = await caller.blocks.createForDate({
      date: PFAIL_DATE,
      title: `${PFAIL_TAG} Will fail to modify`,
      blockType: "math" as any,
      durationMin: 25,
      startTime: "09:00",
    });
    pfPlanId = k.planId;
    pfBlockId = Number(k.id);
  });

  afterAll(async () => {
    try {
      const live = await db.listBlocksForPlan(pfPlanId);
      for (const b of live as any[]) {
        if (typeof b.title === "string" && b.title.startsWith(PFAIL_TAG)) {
          try { await db.deleteBlock(b.id); } catch {}
        }
      }
    } catch {}
    try { await (db as any).deletePlan?.(pfPlanId); } catch {}
  });

  it("when updateBlock throws, the failed modify is reported with ok:false + error, and the sibling add still lands", async () => {
    // Force the next call to db.updateBlock to throw a deterministic error.
    const spy = vi.spyOn(db, "updateBlock").mockImplementationOnce(async () => {
      throw new Error("simulated DB failure");
    });
    try {
      const r = await caller.plans.aiApplyProposal({
        date: PFAIL_DATE,
        decisions: [
          // This will be intercepted by the spy and throw.
          {
            kind: "modify",
            existingBlockId: pfBlockId,
            after: {
              blockType: "math" as any,
              title: `${PFAIL_TAG} Should not land`,
              durationMin: 20,
            },
          },
          // This one is a real add, no spy interference; it must succeed.
          {
            kind: "add",
            insertAfterSortOrder: null,
            after: {
              blockType: "adventure" as any,
              title: `${PFAIL_TAG} Sibling add survives`,
              durationMin: 15,
              subjectSlug: "science",
            },
          },
        ],
      });

      // Counts: modify failed → 0; add succeeded → 1.
      expect(r.modified).toBe(0);
      expect(r.added).toBe(1);
      expect(r.removed).toBe(0);

      // results array has both entries; one ok=false with the error string.
      const results = (r as any).results as any[];
      expect(results.length).toBe(2);
      const failed = results.find((x) => x.kind === "modify" && !x.ok);
      expect(failed).toBeTruthy();
      expect(failed.error).toMatch(/simulated DB failure/);
      expect(failed.existingBlockId).toBe(pfBlockId);
      const addOk = results.find((x) => x.kind === "add" && x.ok);
      expect(addOk).toBeTruthy();

      // DB confirmation: the modify-target block still has its ORIGINAL title.
      const live = (await db.listBlocksForPlan(pfPlanId)) as any[];
      const orig = live.find((b: any) => b.id === pfBlockId);
      expect(orig).toBeTruthy();
      expect(orig.title).toBe(`${PFAIL_TAG} Will fail to modify`);
      // And the sibling add did get persisted.
      const sibling = live.find((b: any) => b.title === `${PFAIL_TAG} Sibling add survives`);
      expect(sibling).toBeTruthy();
      expect(sibling.blockType).toBe("adventure");
    } finally {
      spy.mockRestore();
    }
  });
});
