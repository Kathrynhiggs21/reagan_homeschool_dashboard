import { describe, it, expect } from "vitest";
import { todayCoverage, resumePointer, recentMoodStrip } from "./db";

/**
 * Smoke + shape coverage for the helpers powering Today's HomeAnalyticsStrip:
 *   - today.coverage  → Array<{ subjectSlug, total, done, pct }>
 *   - today.resumePointer → null OR { id, title, subjectSlug, description }
 *   - today.moodStrip → Array<{ date, zone }> with `days` rows
 */

describe("HomeAnalyticsStrip helpers", () => {
  it("todayCoverage returns an array, every row has the expected shape and pct ∈ [0,100]", async () => {
    const cov = await todayCoverage();
    expect(Array.isArray(cov)).toBe(true);
    for (const r of cov) {
      expect(typeof r.subjectSlug).toBe("string");
      expect(Number.isInteger(r.total)).toBe(true);
      expect(Number.isInteger(r.done)).toBe(true);
      expect(r.done).toBeGreaterThanOrEqual(0);
      expect(r.done).toBeLessThanOrEqual(r.total);
      expect(r.pct).toBeGreaterThanOrEqual(0);
      expect(r.pct).toBeLessThanOrEqual(100);
    }
  });

  it("resumePointer returns null OR a fully-shaped pointer", async () => {
    const next = await resumePointer();
    if (next === null) {
      expect(next).toBeNull();
      return;
    }
    expect(typeof next.id).toBe("number");
    expect(typeof next.title === "string" || next.title === null).toBe(true);
    expect(typeof next.subjectSlug).toBe("string");
    // description is text|null — accept both
    expect(typeof next.description === "string" || next.description === null).toBe(true);
  });

  it("recentMoodStrip respects the `days` arg and emits ISO YYYY-MM-DD dates", async () => {
    const strip = await recentMoodStrip(3);
    expect(Array.isArray(strip)).toBe(true);
    expect(strip.length).toBe(3);
    for (const d of strip) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // zone is one of green/yellow/red OR null
      if (d.zone !== null) {
        expect(["green", "yellow", "red"]).toContain(d.zone);
      }
    }
  });

  it("recentMoodStrip clamps reasonably for days=1", async () => {
    const strip = await recentMoodStrip(1);
    expect(strip.length).toBe(1);
    const today = new Date().toISOString().slice(0, 10);
    expect(strip[0].date).toBe(today);
  });
});
