/**
 * seasonalProfile.test.ts — v2.97 (2026-05-27)
 *
 * Locks the seasonal-mode + default-start-time + block-count contract that
 * the AI generator and proposer now depend on. If any future change shifts
 * summer to start at 8:30 or makes the school-year cap 4 blocks, these will
 * fail loudly.
 */
import { describe, it, expect } from "vitest";
import {
  buildSeasonalProfile,
  detectSeasonalMode,
  memorialDay,
  laborDay,
  renderSeasonalPromptFragment,
} from "./_lib/seasonalProfile";

describe("seasonalProfile", () => {
  describe("memorialDay / laborDay", () => {
    it("returns the last Monday of May for 2026", () => {
      const md = memorialDay(2026);
      expect(md.getMonth()).toBe(4); // May (0-indexed)
      expect(md.getDate()).toBe(25); // Mon May 25, 2026
      expect(md.getDay()).toBe(1); // Monday
    });
    it("returns the first Monday of September for 2026", () => {
      const ld = laborDay(2026);
      expect(ld.getMonth()).toBe(8); // September
      expect(ld.getDate()).toBe(7); // Mon Sep 7, 2026
      expect(ld.getDay()).toBe(1); // Monday
    });
  });

  describe("detectSeasonalMode", () => {
    it("flags May 28 2026 as summer (after Memorial Day)", () => {
      expect(detectSeasonalMode(new Date(2026, 4, 28))).toBe("summer");
    });
    it("flags July 4 2026 as summer", () => {
      expect(detectSeasonalMode(new Date(2026, 6, 4))).toBe("summer");
    });
    it("flags Sep 8 2026 as school-year (day after Labor Day)", () => {
      expect(detectSeasonalMode(new Date(2026, 8, 8))).toBe("school-year");
    });
    it("flags March 15 2026 as school-year", () => {
      expect(detectSeasonalMode(new Date(2026, 2, 15))).toBe("school-year");
    });
    it("flags Memorial Day itself as summer", () => {
      expect(detectSeasonalMode(memorialDay(2026))).toBe("summer");
    });
    it("flags Labor Day itself as summer (inclusive)", () => {
      expect(detectSeasonalMode(laborDay(2026))).toBe("summer");
    });
  });

  describe("buildSeasonalProfile summer", () => {
    const p = buildSeasonalProfile(new Date(2026, 5, 15)); // Mon Jun 15, 2026
    it("uses 10am default start", () => {
      expect(p.defaultStart).toBe("10:00");
    });
    it("uses 12:30 default end target", () => {
      expect(p.defaultEnd).toBe("12:30");
    });
    it("targets 4 blocks", () => {
      expect(p.targetBlockCount).toBe(4);
    });
    it("caps specials at 1", () => {
      expect(p.specialsBudget).toBe(1);
    });
    it("focuses on math, ela, reading, outdoor", () => {
      expect(p.focus).toContain("math");
      expect(p.focus).toContain("ela");
      expect(p.focus).toContain("reading");
      expect(p.focus).toContain("outdoor");
    });
  });

  describe("buildSeasonalProfile school year", () => {
    const p = buildSeasonalProfile(new Date(2026, 9, 15)); // Oct 15 2026
    it("uses 8:30am default start", () => {
      expect(p.defaultStart).toBe("08:30");
    });
    it("targets 6 blocks", () => {
      expect(p.targetBlockCount).toBe(6);
    });
    it("allows 2 specials", () => {
      expect(p.specialsBudget).toBe(2);
    });
  });

  describe("Friday lighter rule", () => {
    it("trims summer Friday by 1 block (4 -> 3)", () => {
      const p = buildSeasonalProfile(new Date(2026, 5, 12)); // Fri Jun 12, 2026
      expect(p.fridayLighter).toBe(true);
      expect(p.targetBlockCount).toBe(3);
    });
    it("does not trim non-Friday summer days", () => {
      const p = buildSeasonalProfile(new Date(2026, 5, 11)); // Thu Jun 11, 2026
      expect(p.fridayLighter).toBe(false);
      expect(p.targetBlockCount).toBe(4);
    });
  });

  describe("renderSeasonalPromptFragment", () => {
    it("mentions the mode + default start in the fragment", () => {
      const p = buildSeasonalProfile(new Date(2026, 5, 15));
      const text = renderSeasonalPromptFragment(p);
      expect(text).toContain("summer");
      expect(text).toContain("10:00");
      expect(text).toContain("Target block count: 4");
    });
    it("indicates user-override authority at the end", () => {
      const p = buildSeasonalProfile(new Date(2026, 5, 15));
      const text = renderSeasonalPromptFragment(p);
      expect(text.toLowerCase()).toContain("override");
    });
  });
});
