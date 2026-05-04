import { describe, it, expect } from "vitest";
import {
  PRACTICE_LIBRARY,
  PRACTICE_DAILY_COIN_CAP,
  groupBySubject,
  findDrill,
  isOutsideSchoolHours,
  computePayout,
} from "./_lib/practiceLibrary";

describe("practiceLibrary", () => {
  it("library is non-empty and well-formed", () => {
    expect(PRACTICE_LIBRARY.length).toBeGreaterThan(15);
    for (const d of PRACTICE_LIBRARY) {
      expect(d.slug).toMatch(/^[a-z0-9-]+$/);
      expect(d.url.startsWith("https://")).toBe(true);
      expect(d.minutes).toBeGreaterThan(0);
      expect(d.coins).toBeGreaterThanOrEqual(1);
      expect(d.coins).toBeLessThanOrEqual(PRACTICE_DAILY_COIN_CAP);
    }
    // No duplicate slugs
    const slugs = PRACTICE_LIBRARY.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("groupBySubject returns subjects in expected order, no empties", () => {
    const groups = groupBySubject();
    const order = groups.map((g) => g.subject);
    // Subjects with at least one drill should appear; ordering follows
    // math → ela → spelling → science → social.
    expect(order[0]).toBe("math");
    expect(order).toContain("ela");
    expect(order).toContain("spelling");
    for (const g of groups) {
      expect(g.topics.length).toBeGreaterThan(0);
      for (const t of g.topics) expect(t.drills.length).toBeGreaterThan(0);
    }
  });

  it("findDrill returns a known drill and null for unknowns", () => {
    expect(findDrill("khan-long-division")).not.toBeNull();
    expect(findDrill("not-a-real-slug")).toBeNull();
  });

  it("isOutsideSchoolHours: weekends always allowed, weekdays gated 9–14", () => {
    // Sunday at noon → allowed
    expect(isOutsideSchoolHours(new Date("2026-05-03T18:00:00Z"))).toBe(true);
    // Monday 7 AM local → allowed (before 9)
    const mondayMorning = new Date(2026, 4, 4, 7, 0);
    expect(isOutsideSchoolHours(mondayMorning)).toBe(true);
    // Monday 11 AM local → blocked
    const mondayMid = new Date(2026, 4, 4, 11, 0);
    expect(isOutsideSchoolHours(mondayMid)).toBe(false);
    // Monday 3 PM local → allowed (after 2 PM)
    const mondayAfter = new Date(2026, 4, 4, 15, 0);
    expect(isOutsideSchoolHours(mondayAfter)).toBe(true);
  });

  it("computePayout: blocks during school hours", () => {
    const drill = findDrill("khan-long-division")!;
    const mondayMid = new Date(2026, 4, 4, 11, 0);
    const out = computePayout(drill, 0, mondayMid);
    expect(out.coins).toBe(0);
    expect(out.outsideHours).toBe(false);
    expect(out.reason).toMatch(/before 9 AM/);
  });

  it("computePayout: caps at the daily limit", () => {
    const drill = findDrill("khan-fractions-add")!; // 4 coins
    const evening = new Date(2026, 4, 4, 19, 0);
    // already at 11/12 → only 1 coin left, not the full 4
    const out = computePayout(drill, PRACTICE_DAILY_COIN_CAP - 1, evening);
    expect(out.coins).toBe(1);
    expect(out.capped).toBe(true);
    expect(out.outsideHours).toBe(true);
  });

  it("computePayout: refuses when cap already met", () => {
    const drill = findDrill("khan-long-division")!;
    const evening = new Date(2026, 4, 4, 19, 0);
    const out = computePayout(drill, PRACTICE_DAILY_COIN_CAP, evening);
    expect(out.coins).toBe(0);
    expect(out.capped).toBe(true);
    expect(out.reason).toMatch(/max of/);
  });

  it("computePayout: full payout under normal conditions", () => {
    const drill = findDrill("vocabcom-5")!; // 2 coins
    const evening = new Date(2026, 4, 4, 19, 0);
    const out = computePayout(drill, 0, evening);
    expect(out.coins).toBe(2);
    expect(out.capped).toBe(false);
    expect(out.outsideHours).toBe(true);
  });
});
