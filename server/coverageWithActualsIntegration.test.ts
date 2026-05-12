import { describe, expect, it, beforeAll } from "vitest";
import {
  ensurePlanForDate,
  recordActualEntry,
  todayCoverageWithActuals,
  coverageForDate,
  listActualForDate,
  getDb,
} from "./db";
import { actualAgendaEntries, scheduleBlocks, dailyPlans } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Integration test (real DB) — proves that `todayCoverageWithActuals(dateISO)`
 * is the actual source of truth for Slice 4.5: changes when actualAgendaEntries
 * exist, even if scheduleBlocks.status alone says nothing's done.
 */
describe("Slice 4.5 — coverageWithActuals integration (real DB)", () => {
  // Use far-future isolated date to avoid colliding with other tests' state.
  const TEST_DATE = "2030-08-15";

  beforeAll(async () => {
    // Clean slate for the test date — delete actuals + blocks + plan so
    // ensurePlanForDate truly autobuilds fresh.
    const db = getDb();
    const plans = await db
      .select({ id: dailyPlans.id })
      .from(dailyPlans)
      .where(sql`DATE(${dailyPlans.date}) = ${TEST_DATE}`);
    for (const p of plans) {
      await db.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, p.id));
    }
    await db.delete(actualAgendaEntries).where(eq(actualAgendaEntries.dateISO, TEST_DATE));
    await db.delete(dailyPlans).where(sql`DATE(${dailyPlans.date}) = ${TEST_DATE}`);
  });

  it("with NO actuals → effectivePct equals plannedPct (legacy behavior)", async () => {
    await ensurePlanForDate(TEST_DATE, "full", { allowWeekendAutoBuild: true });
    const planned = await coverageForDate(TEST_DATE);
    const merged = await todayCoverageWithActuals(TEST_DATE);
    // every planned subject has matching effectivePct == plannedPct (because no actuals)
    for (const m of merged) {
      const p = planned.find((x) => x.subjectSlug === m.subjectSlug);
      if (p) {
        expect(m.effectivePct).toBe(p.pct);
        expect(m.actualEntries).toBe(0);
        expect(m.offPlan).toBe(false);
      }
    }
  });

  it("recording an actual entry for a planned subject INCREASES effectivePct above plannedPct", async () => {
    const before = await todayCoverageWithActuals(TEST_DATE);
    const mathBefore = before.find((r) => r.subjectSlug === "math");
    if (!mathBefore) {
      // fallback: pick whatever subject the autobuild seeded
      const target = before[0];
      expect(target).toBeTruthy();
      await recordActualEntry({
        dateISO: TEST_DATE,
        plannedBlockId: null,
        subjectSlug: target!.subjectSlug as any,
        topic: "Vitest math practice",
        minutesSpent: 25,
        source: "mom-input" as any,
        notes: null,
        createdBy: "vitest@test",
      });
      const after = await todayCoverageWithActuals(TEST_DATE);
      const targetAfter = after.find((r) => r.subjectSlug === target!.subjectSlug);
      expect(targetAfter!.actualEntries).toBeGreaterThanOrEqual(1);
      expect(targetAfter!.effectivePct).toBeGreaterThan(target!.effectivePct);
      return;
    }
    await recordActualEntry({
      dateISO: TEST_DATE,
      plannedBlockId: null,
      subjectSlug: "math",
      topic: "Vitest fractions",
      minutesSpent: 30,
      source: "mom-input" as any,
      notes: null,
      createdBy: "vitest@test",
    });
    const after = await todayCoverageWithActuals(TEST_DATE);
    const mathAfter = after.find((r) => r.subjectSlug === "math");
    expect(mathAfter!.actualEntries).toBeGreaterThanOrEqual(1);
    expect(mathAfter!.effectivePct).toBeGreaterThan(mathBefore.effectivePct);
  });

  it("recording an OFF-PLAN actual entry adds an offPlan: true row", async () => {
    // 'pe' is unlikely to be in a planned default block — use it as off-plan probe.
    // If it IS planned, fall back to using a clearly off-plan subject like 'art' or pick a non-listed one.
    const before = await todayCoverageWithActuals(TEST_DATE);
    const offPlanCandidate = ["pe", "art", "music", "social-emotional", "life-skills"].find(
      (s) => !before.some((r) => r.subjectSlug === s),
    ) ?? "pe";

    await recordActualEntry({
      dateISO: TEST_DATE,
      plannedBlockId: null,
      subjectSlug: offPlanCandidate as any,
      topic: "Vitest off-plan: museum walkthrough",
      minutesSpent: 45,
      source: "grandma-recap" as any,
      notes: "Grandma took her to the museum",
      createdBy: "vitest@test",
    });

    const after = await todayCoverageWithActuals(TEST_DATE);
    const offPlanRow = after.find((r) => r.subjectSlug === offPlanCandidate && r.offPlan);
    expect(offPlanRow).toBeTruthy();
    expect(offPlanRow!.offPlan).toBe(true);
    expect(offPlanRow!.plannedTotal).toBe(0);
    expect(offPlanRow!.actualEntries).toBeGreaterThanOrEqual(1);
    expect(offPlanRow!.actualMinutes).toBeGreaterThanOrEqual(45);
    expect(offPlanRow!.effectivePct).toBe(100);
  });

  it("listActualForDate returns the entries we recorded (sanity)", async () => {
    const entries = await listActualForDate(TEST_DATE);
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });
});
