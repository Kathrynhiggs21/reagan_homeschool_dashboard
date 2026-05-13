/**
 * Push 65 (2026-05-13) — Slice 5 summer-mode foundation contract.
 *
 * Pure-function tests, no DB. We pin boundaries that Mom relies on
 * (Jun 6 first day of summer, Aug 15 last day) and the priority order
 * of overrides so a future refactor can't quietly change them.
 */
import { describe, it, expect } from "vitest";
import {
  isSummerWindow,
  isInVacationRanges,
  effectiveSummerActive,
  summerChoiceOptions,
  streakBoostMultiplier,
  summerSettingsFromKv,
  SUMMER_BLOCK_VARIANTS,
} from "./summerMode";

describe("isSummerWindow — default Jun 6 → Aug 15 inclusive", () => {
  it("Jun 5 is school", () => {
    expect(isSummerWindow("2026-06-05")).toBe(false);
  });
  it("Jun 6 is summer", () => {
    expect(isSummerWindow("2026-06-06")).toBe(true);
  });
  it("Jul 4 is summer", () => {
    expect(isSummerWindow("2026-07-04")).toBe(true);
  });
  it("Aug 15 is summer", () => {
    expect(isSummerWindow("2026-08-15")).toBe(true);
  });
  it("Aug 16 is school", () => {
    expect(isSummerWindow("2026-08-16")).toBe(false);
  });
  it("respects custom start/end", () => {
    expect(isSummerWindow("2026-05-25", { start: "05-20", end: "08-01" })).toBe(true);
    expect(isSummerWindow("2026-08-02", { start: "05-20", end: "08-01" })).toBe(false);
  });
});

describe("isInVacationRanges", () => {
  it("returns false when no ranges given", () => {
    expect(isInVacationRanges("2026-07-04", null)).toBe(false);
    expect(isInVacationRanges("2026-07-04", [])).toBe(false);
  });
  it("true when date is inside a range (inclusive)", () => {
    expect(
      isInVacationRanges("2026-07-04", [{ start: "2026-07-01", end: "2026-07-10" }]),
    ).toBe(true);
    expect(
      isInVacationRanges("2026-07-01", [{ start: "2026-07-01", end: "2026-07-10" }]),
    ).toBe(true);
    expect(
      isInVacationRanges("2026-07-10", [{ start: "2026-07-01", end: "2026-07-10" }]),
    ).toBe(true);
  });
  it("false when outside all ranges", () => {
    expect(
      isInVacationRanges("2026-07-11", [{ start: "2026-07-01", end: "2026-07-10" }]),
    ).toBe(false);
  });
});

describe("effectiveSummerActive priority order", () => {
  it("override 'off' beats everything (Mom blanks summer)", () => {
    const r = effectiveSummerActive("2026-07-04", { override: "off" });
    expect(r).toEqual({ active: false, reason: "manual-off" });
  });
  it("override 'on' beats school-year window", () => {
    const r = effectiveSummerActive("2026-05-01", { override: "on" });
    expect(r).toEqual({ active: true, reason: "manual-on" });
  });
  it("vacation range beats auto window", () => {
    const r = effectiveSummerActive("2026-07-04", {
      vacationRanges: [{ start: "2026-07-01", end: "2026-07-10" }],
    });
    expect(r).toEqual({ active: false, reason: "vacation" });
  });
  it("auto window default on => Jun 6 is summer", () => {
    const r = effectiveSummerActive("2026-06-06", {});
    expect(r).toEqual({ active: true, reason: "auto" });
  });
  it("autoFlipEnabled=false disables auto window", () => {
    const r = effectiveSummerActive("2026-06-06", { autoFlipEnabled: false });
    expect(r).toEqual({ active: false, reason: "school-year" });
  });
  it("outside window returns school-year", () => {
    expect(effectiveSummerActive("2026-04-01", {}).active).toBe(false);
    expect(effectiveSummerActive("2026-11-15", {}).active).toBe(false);
  });
});

describe("SUMMER_BLOCK_VARIANTS registry", () => {
  it("covers all 5 block types", () => {
    for (const key of ["reading", "math", "adventure", "practice", "choice"]) {
      expect(SUMMER_BLOCK_VARIANTS[key]).toBeDefined();
      expect(SUMMER_BLOCK_VARIANTS[key].length).toBe(4);
    }
  });
  it("every block type offers all 4 variant kinds", () => {
    for (const key of Object.keys(SUMMER_BLOCK_VARIANTS)) {
      const kinds = new Set(SUMMER_BLOCK_VARIANTS[key].map((v) => v.kind));
      expect(kinds.has("outdoor")).toBe(true);
      expect(kinds.has("library")).toBe(true);
      expect(kinds.has("game")).toBe(true);
      expect(kinds.has("hands-on")).toBe(true);
    }
  });
});

describe("summerChoiceOptions — deterministic 3-of-4 picker", () => {
  it("returns exactly 3 picks", () => {
    expect(summerChoiceOptions("reading", "2026-07-04").length).toBe(3);
  });
  it("same seed => same picks", () => {
    const a = summerChoiceOptions("math", "2026-07-04");
    const b = summerChoiceOptions("math", "2026-07-04");
    expect(a.map((v) => v.title)).toEqual(b.map((v) => v.title));
  });
  it("different seeds may rotate", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const seed = `2026-07-${String(d).padStart(2, "0")}`;
      seen.add(summerChoiceOptions("adventure", seed).map((v) => v.title).join("|"));
    }
    // At least 2 distinct rotations across 30 seeds — guards against constant output.
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
  it("never returns duplicates inside one call", () => {
    const titles = summerChoiceOptions("practice", "test").map((v) => v.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("streakBoostMultiplier", () => {
  it("returns 1× outside summer regardless of streak", () => {
    expect(streakBoostMultiplier(0, false)).toBe(1);
    expect(streakBoostMultiplier(20, false)).toBe(1);
  });
  it("returns 1× inside summer for streaks under 5", () => {
    expect(streakBoostMultiplier(0, true)).toBe(1);
    expect(streakBoostMultiplier(4, true)).toBe(1);
  });
  it("adds +0.5× per 5-day streak inside summer", () => {
    expect(streakBoostMultiplier(5, true)).toBe(1.5);
    expect(streakBoostMultiplier(10, true)).toBe(2);
    expect(streakBoostMultiplier(15, true)).toBe(2.5);
  });
  it("caps at 3×", () => {
    expect(streakBoostMultiplier(20, true)).toBe(3);
    expect(streakBoostMultiplier(9999, true)).toBe(3);
  });
});

describe("summerSettingsFromKv parses appSettings rows", () => {
  it("parses all keys", () => {
    const s = summerSettingsFromKv({
      "summer.autoFlipEnabled": "0",
      "summer.start": "06-10",
      "summer.end": "08-20",
      "summer.override": "off",
      "summer.vacationRanges": JSON.stringify([{ start: "2026-07-01", end: "2026-07-10" }]),
    });
    expect(s.autoFlipEnabled).toBe(false);
    expect(s.start).toBe("06-10");
    expect(s.end).toBe("08-20");
    expect(s.override).toBe("off");
    expect(s.vacationRanges?.length).toBe(1);
  });
  it("tolerates missing keys + bad JSON", () => {
    const s = summerSettingsFromKv({ "summer.vacationRanges": "not-json" });
    expect(s.vacationRanges).toBeUndefined();
  });
  it("rejects invalid override values", () => {
    const s = summerSettingsFromKv({ "summer.override": "yes" });
    expect(s.override).toBeUndefined();
  });
});


/**
 * Wire-up checks: the public allowlist must include the 5 summer.* keys,
 * SummerModeBadge must exist + be mounted on Today.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Push 65 wire-up — public allowlist + Today mount", () => {
  const ROUTERS = readFileSync(join(__dirname, "routers.ts"), "utf8");
  const BADGE = readFileSync(
    join(__dirname, "..", "client", "src", "components", "SummerModeBadge.tsx"),
    "utf8",
  );
  const TODAY = readFileSync(
    join(__dirname, "..", "client", "src", "pages", "Today.tsx"),
    "utf8",
  );

  for (const key of [
    "summer.autoFlipEnabled",
    "summer.start",
    "summer.end",
    "summer.override",
    "summer.vacationRanges",
  ]) {
    it(`prefs.getPublic allows ${key}`, () => {
      expect(ROUTERS).toContain(`"${key}"`);
    });
  }

  it("SummerModeBadge reads the 5 summer.* keys via prefs.getPublic", () => {
    expect(BADGE).toMatch(/key:\s*"summer\.autoFlipEnabled"/);
    expect(BADGE).toMatch(/key:\s*"summer\.start"/);
    expect(BADGE).toMatch(/key:\s*"summer\.end"/);
    expect(BADGE).toMatch(/key:\s*"summer\.override"/);
    expect(BADGE).toMatch(/key:\s*"summer\.vacationRanges"/);
  });

  it("SummerModeBadge self-hides when not active (no-info rule)", () => {
    expect(BADGE).toMatch(/if\s*\(!active\)\s*return null/);
  });

  it("Today.tsx imports and mounts SummerModeBadge", () => {
    expect(TODAY).toMatch(/from\s+"@\/components\/SummerModeBadge"/);
    expect(TODAY).toMatch(/<SummerModeBadge\s*\/>/);
  });
});
