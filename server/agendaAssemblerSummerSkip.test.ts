import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { assembleAgendaForDate } from "./_lib/agendaAssembler";
import * as db from "./db";

/**
 * Summer-mode skip rule for the nightly agenda email cron.
 *
 * Background:
 *   The 8 PM nightly-agenda-email cron picks the next school weekday and
 *   builds an agenda PDF. In summer mode, Mom + Grandma decide each morning
 *   whether to "do school" — many days will be skipped. We don't want the
 *   cron to send empty emails or emit "no school day found" alerts on those
 *   skip days.
 *
 * The fix lives inside `assembleAgendaForDate(dateStr)`:
 *   - If the dailyPlans row exists with status='skipped' → return null.
 *   - If the dailyPlans row exists but has 0 scheduleBlocks → return null.
 *   - If the row doesn't exist at all → return null (already the case).
 *
 * The /api/scheduled/nightly-agenda-email handler already maps a null payload
 * to `{ ok: true, status: "no_plan" }`, so the agent sees a clean signal and
 * stays silent. This test locks the assembler-side guard.
 */

describe("agendaAssembler summer-mode skip rule", () => {
  /* ------------------------ PART A: source contract ------------------------ */
  const src = fs.readFileSync(
    path.join(__dirname, "_lib", "agendaAssembler.ts"),
    "utf8",
  );

  it("returns null when plan is missing (existing behavior preserved)", () => {
    expect(src).toContain("if (!plan) return null;");
  });

  it("returns null when plan.status === 'skipped'", () => {
    expect(src).toMatch(/plan as any\)?\.status === "skipped"\) return null/);
  });

  it("returns null when plan exists but has zero blocks", () => {
    expect(src).toMatch(/blocksRaw\.length === 0\) return null/);
  });

  it("the skip guard sits BEFORE topic / book / lesson hydration (saves a roundtrip)", () => {
    const earlyReturnIdx = src.indexOf('blocksRaw.length === 0) return null');
    const topicLookupIdx = src.indexOf("curriculumTopicId");
    expect(earlyReturnIdx).toBeGreaterThan(0);
    expect(topicLookupIdx).toBeGreaterThan(0);
    expect(earlyReturnIdx).toBeLessThan(topicLookupIdx);
  });

  /* --------------------- PART B: real-DB integration ----------------------- */

  const FUTURE_SKIPPED_DATE = "2031-06-09"; // future Monday
  const FUTURE_EMPTY_DATE = "2031-06-10"; // future Tuesday
  const FUTURE_MISSING_DATE = "2031-06-11"; // future Wednesday

  it("real DB: assembler returns null for a future plan with status='skipped'", async () => {
    // Best-effort cleanup of any prior test rows
    try {
      const dbi = db.getDb();
      const { sql } = await import("drizzle-orm");
      await dbi.execute(sql.raw(`DELETE FROM dailyPlans WHERE date = '${FUTURE_SKIPPED_DATE}'`));
    } catch {}

    // Insert a skipped plan (no blocks)
    const dbi = db.getDb();
    const { sql } = await import("drizzle-orm");
    await dbi.execute(sql.raw(
      `INSERT INTO dailyPlans (date, dayType, status, notes) VALUES ('${FUTURE_SKIPPED_DATE}', 'full', 'skipped', 'test: skipped day, summer mode')`
    ));

    const result = await assembleAgendaForDate(FUTURE_SKIPPED_DATE);
    expect(result).toBeNull();

    // cleanup
    await dbi.execute(sql.raw(`DELETE FROM dailyPlans WHERE date = '${FUTURE_SKIPPED_DATE}'`));
  });

  it("real DB: assembler returns null for a future plan with status='planned' but 0 blocks", async () => {
    const dbi = db.getDb();
    const { sql } = await import("drizzle-orm");
    try { await dbi.execute(sql.raw(`DELETE FROM dailyPlans WHERE date = '${FUTURE_EMPTY_DATE}'`)); } catch {}
    await dbi.execute(sql.raw(
      `INSERT INTO dailyPlans (date, dayType, status, notes) VALUES ('${FUTURE_EMPTY_DATE}', 'full', 'planned', 'test: planned but empty')`
    ));
    const result = await assembleAgendaForDate(FUTURE_EMPTY_DATE);
    expect(result).toBeNull();
    await dbi.execute(sql.raw(`DELETE FROM dailyPlans WHERE date = '${FUTURE_EMPTY_DATE}'`));
  });

  it("real DB: assembler returns null for a date with no plan row at all", async () => {
    // Make sure nothing exists for this date
    const dbi = db.getDb();
    const { sql } = await import("drizzle-orm");
    await dbi.execute(sql.raw(`DELETE FROM dailyPlans WHERE date = '${FUTURE_MISSING_DATE}'`));
    const result = await assembleAgendaForDate(FUTURE_MISSING_DATE);
    expect(result).toBeNull();
  });
});
