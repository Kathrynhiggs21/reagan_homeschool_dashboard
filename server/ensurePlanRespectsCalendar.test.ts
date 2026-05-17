/**
 * v2.22 (2026-05-17) — ensurePlanForDate respects schoolCalendar.isOff.
 *
 * The original ensurePlanForDate skipped weekends but did NOT consult
 * schoolCalendar, so an Indian-Hill staff day (e.g. 2025-09-01 Labor
 * Day) would still auto-build a "full" school day's worth of blocks.
 * v2.22 teaches it to call isSchoolOff(dateStr) and treat off-days
 * the same way it treats Sat/Sun: the plan row is created with
 * dayType="off" so the UI can say "no school today," but no blocks
 * are auto-built unless the caller explicitly opts in.
 *
 * Real-DB integration test against the IH 25-26 dataset seeded in v2.17.
 */
import { describe, it, expect } from "vitest";
import {
  ensurePlanForDate,
  getPlanByDate,
  listBlocksForPlan,
  insertSchoolCalendar,
  isSchoolOff,
} from "./db";
import { getDb } from "./db";
import { dailyPlans, scheduleBlocks, schoolCalendar } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Pick a test date far in the future so we don't collide with real data.
const OFF_DATE = "2099-09-01"; // future Labor-Day-ish date for the test
const SCHOOL_DATE = "2099-09-02"; // future Tue, no holiday

async function clearTestDate(d: string) {
  const db = getDb();
  // Delete blocks first (FK to dailyPlans), then plan, then calendar entry.
  const plan = await getPlanByDate(d);
  if (plan) {
    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, plan.id));
    await db.delete(dailyPlans).where(eq(dailyPlans.id, plan.id));
  }
  await db.delete(schoolCalendar).where(eq(schoolCalendar.date as any, d as any));
}

describe("v2.22 — ensurePlanForDate respects schoolCalendar.isOff", () => {
  it("when the date is flagged isOff=true, plan is created as off-day with NO auto-built blocks", async () => {
    await clearTestDate(OFF_DATE);
    // Seed the off-day calendar row.
    await insertSchoolCalendar({
      date: OFF_DATE as any,
      label: "Test Holiday — v2.22",
      isOff: true,
    } as any);
    // Sanity: the helper agrees.
    expect(await isSchoolOff(OFF_DATE)).toBe(true);

    const plan = await ensurePlanForDate(OFF_DATE, "full");
    expect(plan).toBeTruthy();
    expect((plan as any).dayType).toBe("off");

    const blocks = await listBlocksForPlan((plan as any).id);
    expect(blocks.length).toBe(0);

    await clearTestDate(OFF_DATE);
  }, 30_000);

  it("when the date is NOT flagged off, plan is created as full school day WITH auto-built blocks", async () => {
    await clearTestDate(SCHOOL_DATE);
    // Confirm there is no calendar row for this date (clean baseline).
    expect(await isSchoolOff(SCHOOL_DATE)).toBe(false);

    const plan = await ensurePlanForDate(SCHOOL_DATE, "full");
    expect(plan).toBeTruthy();
    // 2099-09-02 is a Wednesday → "half" day (therapy variant), not "off".
    // The point is just that it's NOT "off" — auto-build still runs.
    expect((plan as any).dayType).not.toBe("off");

    const blocks = await listBlocksForPlan((plan as any).id);
    expect(blocks.length).toBeGreaterThanOrEqual(5);

    await clearTestDate(SCHOOL_DATE);
  }, 30_000);

  it("explicit allowOffDayAutoBuild=true overrides the off-day skip (rare admin case)", async () => {
    await clearTestDate(OFF_DATE);
    await insertSchoolCalendar({
      date: OFF_DATE as any,
      label: "Test Holiday — v2.22 enrichment",
      isOff: true,
    } as any);

    const plan = await ensurePlanForDate(OFF_DATE, "full", {
      allowOffDayAutoBuild: true,
    });
    expect(plan).toBeTruthy();
    // dayType is still "off" (the calendar still says no school) but
    // the auto-build was explicitly opted into for an enrichment day.
    expect((plan as any).dayType).toBe("off");

    const blocks = await listBlocksForPlan((plan as any).id);
    expect(blocks.length).toBeGreaterThanOrEqual(1);

    await clearTestDate(OFF_DATE);
  }, 30_000);
});
