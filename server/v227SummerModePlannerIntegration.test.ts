/**
 * v2.27 — real-DB integration: ensurePlanForDate produces a summer plan for
 * a regular weekday inside the auto window (default Jun 6 – Aug 15).
 *
 * Uses a future date that has no existing plan, exercises the planner
 * against the live DB, then cleans up. We pick a known "regular weekday"
 * inside the auto window that is NOT in schoolCalendar (so we don't
 * collide with off-day handling).
 */

import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { dailyPlans, scheduleBlocks } from "../drizzle/schema";
import { ensurePlanForDate } from "./db";
import { isSchoolOff } from "./db";

// July 15 of next year is reliably a weekday + reliably inside the default
// summer window + reliably not on any IH calendar (next year not seeded).
function pickFutureSummerWeekday(): string {
  const today = new Date();
  // Use next year's July 15 to avoid colliding with anything seeded.
  const target = new Date(Date.UTC(today.getUTCFullYear() + 1, 6, 15));
  // Adjust to a weekday if Jul 15 happens to be Sat/Sun.
  const dow = target.getUTCDay();
  if (dow === 0) target.setUTCDate(target.getUTCDate() + 1);
  if (dow === 6) target.setUTCDate(target.getUTCDate() + 2);
  return target.toISOString().slice(0, 10);
}

const TARGET = pickFutureSummerWeekday();

describe("v2.27 — Summer Mode auto-flip on a real future weekday", () => {
  afterAll(async () => {
    // Clean up: delete the plan + its blocks we created.
    const db = getDb();
    const rows = (await db.select().from(dailyPlans).where(eq(dailyPlans.date as any, TARGET as any))) as any[];
    for (const p of rows) {
      await db.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, p.id));
      await db.delete(dailyPlans).where(eq(dailyPlans.id, p.id));
    }
  });

  it(`${TARGET} is a regular weekday inside the default summer window`, async () => {
    const isOff = await isSchoolOff(TARGET);
    expect(isOff).toBe(false);
    const dow = new Date(TARGET + "T00:00:00").getDay();
    expect([1, 2, 3, 4, 5]).toContain(dow);
    // Confirm the date string lies between 06-06 and 08-15 (lex compare on MM-DD).
    const mmdd = TARGET.slice(5);
    expect(mmdd >= "06-06" && mmdd <= "08-15").toBe(true);
  });

  it("ensurePlanForDate creates a plan with dayType='outdoor' (summer reuses outdoor enum)", async () => {
    const plan = await ensurePlanForDate(TARGET);
    expect(plan).toBeTruthy();
    expect((plan as any).dayType).toBe("outdoor");
  });

  it("auto-built blocks include the v2.27 summer template signatures", async () => {
    const plan = await ensurePlanForDate(TARGET);
    expect(plan).toBeTruthy();
    const db = getDb();
    const blocks = (await db
      .select()
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.planId, (plan as any).id))) as any[];
    const titles = blocks.map((b) => String(b.title || ""));
    expect(titles.some((t) => t.includes("Summer charge"))).toBe(true);
    expect(titles.some((t) => t.includes("Summer adventure"))).toBe(true);
    expect(titles.some((t) => t.includes("Summer choice"))).toBe(true);
    expect(titles.some((t) => t.includes("Cozy reading"))).toBe(true);
    expect(titles.some((t) => t.includes("Tiny practice"))).toBe(true);
    expect(titles.some((t) => t.includes("One little win"))).toBe(true);
    // Critically: should NOT include school-year block titles like "Math warm-up".
    expect(titles.some((t) => t.includes("Math warm-up"))).toBe(false);
    expect(titles.some((t) => t.includes("Reading + writing"))).toBe(false);
    expect(titles.some((t) => t.includes("Science adventure"))).toBe(false);
  });
});
