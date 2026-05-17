import { describe, it, expect } from "vitest";
import {
  pickActivityOptions,
  ACTIVITY_POOL,
  seasonOf,
  partOfDay,
} from "./_lib/activityOptions";

describe("Activity Options weighted picker", () => {
  const may2 = new Date(2026, 4, 2, 14, 0, 0); // Sat afternoon, late spring

  it("returns at most 10 ideas", () => {
    const out = pickActivityOptions({
      interests: [],
      tempF: 70,
      weather: "clear",
      now: may2,
    });
    expect(out.length).toBeLessThanOrEqual(10);
  });

  it("ranks interest matches above non-matches", () => {
    const out = pickActivityOptions({
      interests: ["birds", "creek"],
      tempF: 70,
      weather: "clear",
      now: may2,
    });
    const top = out[0];
    expect(["bird-window-count", "creek-bug-hunt"]).toContain(top.id);
    expect(top.score).toBeGreaterThan(0);
    expect(top.reasons.some((r) => r.includes("birds") || r.includes("creek"))).toBe(true);
  });

  it("punishes outdoor ideas in cold rain", () => {
    const winterRain = new Date(2026, 0, 15, 14, 0, 0); // Jan
    const out = pickActivityOptions({
      interests: ["creek"],
      tempF: 35,
      weather: "rain",
      now: winterRain,
    });
    const creek = out.find((o) => o.id === "creek-bug-hunt");
    // Either filtered out (>10 limit) or scored low.
    if (creek) {
      const fort = out.find((o) => o.id === "rainy-fort-read");
      expect((fort?.score ?? 0)).toBeGreaterThan(creek.score);
    }
  });

  it("seasonOf correctly buckets months", () => {
    expect(seasonOf(new Date(2026, 0, 1))).toBe("winter");
    expect(seasonOf(new Date(2026, 3, 1))).toBe("spring");
    expect(seasonOf(new Date(2026, 6, 1))).toBe("summer");
    expect(seasonOf(new Date(2026, 9, 1))).toBe("fall");
  });

  it("partOfDay correctly buckets hours", () => {
    expect(partOfDay(new Date(2026, 0, 1, 8))).toBe("morning");
    expect(partOfDay(new Date(2026, 0, 1, 14))).toBe("afternoon");
    expect(partOfDay(new Date(2026, 0, 1, 20))).toBe("evening");
  });

  it("pool covers the 4 core planning subjects + has at least 12 candidates", () => {
    // After 2026-05-17 canonical 7-subject taxonomy migration. The pool's
    // existing entries map cleanly to the 4 core subjects (social, science,
    // ela, math). The optional subjects (health-pe, art-music, other) are
    // valid in the type but the activity pool doesn't have entries in those
    // categories yet — they're catalog-only for assignment categorization.
    // "specials" was retired entirely.
    const subjects = new Set(ACTIVITY_POOL.map((c) => c.subject));
    for (const s of ["social", "science", "ela", "math"] as const) {
      expect(subjects.has(s)).toBe(true);
    }
    expect(subjects.has("specials" as any)).toBe(false);
    expect(ACTIVITY_POOL.length).toBeGreaterThanOrEqual(12);
  });
});
