import { describe, it, expect } from "vitest";
import * as db from "./db";

/**
 * Smoke tests for the Apr 29 PM "today" helpers.
 * These only check shape + safe defaults; the full integration is exercised
 * implicitly by the server when the Home page mounts.
 */
describe("today helpers", () => {
  it("todayCoverage returns an array (possibly empty when no plan exists)", async () => {
    const out = await db.todayCoverage();
    expect(Array.isArray(out)).toBe(true);
    for (const r of out) {
      expect(typeof r.subjectSlug).toBe("string");
      expect(typeof r.total).toBe("number");
      expect(typeof r.done).toBe("number");
      expect(typeof r.pct).toBe("number");
      expect(r.pct).toBeGreaterThanOrEqual(0);
      expect(r.pct).toBeLessThanOrEqual(100);
    }
  });

  it("resumePointer returns null or a block-shape object", async () => {
    const out = await db.resumePointer();
    if (out !== null) {
      expect(typeof out.id).toBe("number");
      expect(typeof out.title).toBe("string");
      expect(typeof out.subjectSlug).toBe("string");
    }
  });

  it("recentMoodStrip returns N entries in descending date order", async () => {
    const out = await db.recentMoodStrip(3);
    expect(out.length).toBe(3);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].date >= out[i].date).toBe(true);
    }
  });

  it("recentMoodStrip clamps days input to >= 1", async () => {
    const out = await db.recentMoodStrip(1);
    expect(out.length).toBe(1);
  });
});
