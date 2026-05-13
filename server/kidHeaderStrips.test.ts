import { describe, it, expect } from "vitest";
import { todayCoverageWithActuals, recentMoodStrip, resumePointer } from "./db";

/**
 * Push 59 (2026-05-13) — KidHeaderStrips contract lock.
 *
 * KidHeaderStrips renders three calm cards at the top of Today for
 * Reagan: progress %, 3-day mood dots, resume-where-left-off card.
 *
 * The kid-side React component reads the same helpers the adult
 * HomeAnalyticsStrip already uses:
 *   - today.coverageWithActuals  → effectivePct per planned subject
 *   - today.moodStrip(3)         → exactly 3 day rows in chrono order
 *   - today.resumePointer        → null OR { id, title, subjectSlug, description }
 *
 * If any of these shapes ever drift, the kid strip silently breaks.
 * This spec is the lockdown.
 */

describe("Push 59 — KidHeaderStrips contract", () => {
  it("coverageWithActuals exposes every field KidHeaderStrips reads (plannedTotal, effectivePct, offPlan)", async () => {
    const rows = await todayCoverageWithActuals();
    expect(Array.isArray(rows)).toBe(true);
    for (const r of rows) {
      expect(typeof r.subjectSlug).toBe("string");
      expect(Number.isInteger(r.plannedTotal)).toBe(true);
      expect(r.plannedTotal).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(r.effectivePct)).toBe(true);
      expect(r.effectivePct).toBeGreaterThanOrEqual(0);
      expect(r.effectivePct).toBeLessThanOrEqual(100);
      expect(typeof r.offPlan).toBe("boolean");
    }
  });

  it("moodStrip(3) always returns exactly 3 rows with zone ∈ {green,yellow,red,null}", async () => {
    const strip = await recentMoodStrip(3);
    expect(strip.length).toBe(3);
    for (const d of strip) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (d.zone !== null) {
        expect(["green", "yellow", "red"]).toContain(d.zone);
      }
    }
  });

  it("moodStrip dates are in reverse chronological order (newest first)", async () => {
    const strip = await recentMoodStrip(3);
    for (let i = 1; i < strip.length; i++) {
      expect(strip[i - 1].date >= strip[i].date).toBe(true);
    }
  });

  it("resumePointer is either null OR a fully-shaped pointer with the fields KidHeaderStrips renders", async () => {
    const next = await resumePointer();
    if (next === null) {
      expect(next).toBeNull();
      return;
    }
    expect(typeof next.id).toBe("number");
    expect(next.id).toBeGreaterThan(0);
    // title may legitimately be empty-string from older blocks, but never null
    expect(typeof next.title).toBe("string");
    expect(typeof next.subjectSlug).toBe("string");
    expect(next.subjectSlug.length).toBeGreaterThan(0);
    expect(typeof next.description === "string" || next.description === null).toBe(true);
  });

  it("KidHeaderStrips effectivePct math: planned-done is bounded by plannedTotal", async () => {
    // The kid card computes
    //   effectiveDone = round((effectivePct/100) * plannedTotal)
    //   pctToday      = round(effectiveDone / sum(plannedTotal) * 100)
    // Anchor: effectiveDone per subject can never exceed plannedTotal.
    const rows = await todayCoverageWithActuals();
    for (const r of rows) {
      if (r.offPlan) continue; // off-plan rows have plannedTotal=0
      const effectiveDone = Math.round((r.effectivePct / 100) * r.plannedTotal);
      expect(effectiveDone).toBeLessThanOrEqual(r.plannedTotal);
    }
  });
});
