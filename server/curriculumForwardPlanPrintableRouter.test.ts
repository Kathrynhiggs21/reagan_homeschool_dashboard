/**
 * curriculumForwardPlanPrintableRouter.test — Push 2.12 (2026-05-17)
 *
 * Real-DB router test for the new familyAdmin curriculum.forwardPlan.printable
 * query. Mirrors the createCaller setup pattern from classroomRouter.test /
 * curriculumForwardPlanRouter.test.
 *
 * What we cover:
 *   1. familyAdmin gate: anonymous / non-admin caller is rejected.
 *   2. Returns the print-model shape (title + dateRange + days[].slots[]).
 *   3. Honors a custom title.
 *   4. Empty horizon (0-day) is rejected by zod.
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import type { Context } from "./_core/context";

function makeAdminCtx(): Context {
  // Mirror the shape used by other router tests: sets ctx.user with an admin
  // role so familyAdminProcedure passes its `role==='admin'` gate.
  const db = getDb();
  return {
    db,
    user: {
      id: 999_001,
      openId: "test-admin",
      name: "Test Admin",
      role: "admin",
      email: "spear.cpt@gmail.com",
    },
  } as unknown as Context;
}
function makeAnonCtx(): Context {
  const db = getDb();
  return { db, user: null } as unknown as Context;
}

describe("curriculum.forwardPlan.printable router", () => {
  it("rejects anonymous callers", async () => {
    const caller = appRouter.createCaller(makeAnonCtx());
    await expect(
      caller.curriculum.forwardPlan.printable({ horizonDays: 5 }),
    ).rejects.toThrow();
  });

  it("returns the printable shape for an admin caller", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const out = await caller.curriculum.forwardPlan.printable({
      startDate: "2027-09-13",
      horizonDays: 5,
    });
    expect(out).toMatchObject({
      title: expect.stringContaining("Reagan's plan"),
    });
    expect(out.dateRange).not.toBeNull();
    expect(Array.isArray(out.days)).toBe(true);
    // Each day has a date + label + slots[]
    for (const d of out.days) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof d.label).toBe("string");
      expect(Array.isArray(d.slots)).toBe(true);
      for (const s of d.slots) {
        expect(typeof s.subject).toBe("string");
        expect(typeof s.code).toBe("string");
        expect(typeof s.title).toBe("string");
      }
    }
    expect(out.totals.topics).toBeGreaterThan(0);
  });

  it("honors a custom title override", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const out = await caller.curriculum.forwardPlan.printable({
      startDate: "2027-09-13",
      horizonDays: 3,
      title: "Catch-up sprint",
    });
    expect(out.title.startsWith("Catch-up sprint")).toBe(true);
  });

  it("rejects horizonDays=0 via zod (min 1)", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    await expect(
      caller.curriculum.forwardPlan.printable({ horizonDays: 0 } as any),
    ).rejects.toThrow();
  });
});
