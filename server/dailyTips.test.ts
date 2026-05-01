import { describe, it, expect } from "vitest";
import { dailyTipForDate, DAILY_TIPS, localDateKey } from "../client/src/lib/dailyTips";

describe("dailyTipForDate (deterministic)", () => {
  it("returns the same tip for the same date", () => {
    expect(dailyTipForDate("2026-05-01")).toBe(dailyTipForDate("2026-05-01"));
    expect(dailyTipForDate("2026-05-02")).toBe(dailyTipForDate("2026-05-02"));
  });

  it("returns a non-empty tip from the pool", () => {
    const t = dailyTipForDate("2026-05-01");
    expect(typeof t).toBe("string");
    expect(t.length).toBeGreaterThan(0);
    expect(DAILY_TIPS).toContain(t);
  });

  it("rotates across the year (>= 5 distinct tips in 30 days)", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const key = `2026-05-${String(d).padStart(2, "0")}`;
      seen.add(dailyTipForDate(key));
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it("localDateKey returns YYYY-MM-DD shape", () => {
    const k = localDateKey(new Date(2026, 4, 1)); // May 1, 2026
    expect(k).toBe("2026-05-01");
  });

  it("works against a tiny custom pool too", () => {
    const tip = dailyTipForDate("2026-05-01", ["only one"]);
    expect(tip).toBe("only one");
  });
});
