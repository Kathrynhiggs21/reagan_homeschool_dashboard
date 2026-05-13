/**
 * Push 83 (2026-05-13) — Summer streak boost contract.
 *
 * Locks:
 *  1) Pure `dailyBlockCompletionStreak` helper math.
 *  2) `streakBoostMultiplier` curve (1×, 1.5×, 2×, 2.5×, cap 3×) and the
 *     hard rule that the boost ONLY applies when summer is active.
 *  3) `awardSticker` returns a `streakBoostMultiplier` field, integrates
 *     pure helpers, and applies via `Math.round(baseCoins × multiplier)`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dailyBlockCompletionStreak,
  previousIsoDay,
  shiftIsoDay,
} from "./_lib/completionStreak";
import { streakBoostMultiplier } from "./summerMode";

const ROOT = join(__dirname, "..");
const DB_TS = readFileSync(join(ROOT, "server/db.ts"), "utf8");
const STREAK_TS = readFileSync(
  join(ROOT, "server/_lib/completionStreak.ts"),
  "utf8",
);

describe("Push 83 — dailyBlockCompletionStreak (pure)", () => {
  const AS_OF = "2026-07-15";

  it("returns 0 for empty input", () => {
    expect(dailyBlockCompletionStreak([], AS_OF)).toBe(0);
  });

  it("returns 0 when today is not in the set (no completion today = streak ended)", () => {
    expect(
      dailyBlockCompletionStreak(["2026-07-14", "2026-07-13"], AS_OF),
    ).toBe(0);
  });

  it("returns 1 for today only", () => {
    expect(dailyBlockCompletionStreak([AS_OF], AS_OF)).toBe(1);
  });

  it("returns 2 for today + yesterday", () => {
    expect(
      dailyBlockCompletionStreak([AS_OF, "2026-07-14"], AS_OF),
    ).toBe(2);
  });

  it("breaks on a 1-day gap", () => {
    expect(
      dailyBlockCompletionStreak([AS_OF, "2026-07-13"], AS_OF),
    ).toBe(1);
  });

  it("tolerates duplicates and unsorted input", () => {
    expect(
      dailyBlockCompletionStreak(
        ["2026-07-13", AS_OF, AS_OF, "2026-07-14", "2026-07-13"],
        AS_OF,
      ),
    ).toBe(3);
  });

  it("ignores malformed day-keys", () => {
    expect(
      dailyBlockCompletionStreak([AS_OF, "not-a-date", "2026-07-14"], AS_OF),
    ).toBe(2);
  });

  it("works across month boundaries", () => {
    expect(
      dailyBlockCompletionStreak(
        ["2026-08-01", "2026-07-31", "2026-07-30"],
        "2026-08-01",
      ),
    ).toBe(3);
  });

  it("works across year boundaries", () => {
    expect(
      dailyBlockCompletionStreak(
        ["2027-01-01", "2026-12-31", "2026-12-30"],
        "2027-01-01",
      ),
    ).toBe(3);
  });

  it("previousIsoDay subtracts one calendar day", () => {
    expect(previousIsoDay("2026-08-01")).toBe("2026-07-31");
    expect(previousIsoDay("2027-01-01")).toBe("2026-12-31");
  });

  it("shiftIsoDay handles negative and positive deltas", () => {
    expect(shiftIsoDay("2026-07-15", -7)).toBe("2026-07-08");
    expect(shiftIsoDay("2026-07-15", 7)).toBe("2026-07-22");
  });
});

describe("Push 83 — streakBoostMultiplier curve", () => {
  it("returns 1× when summer is inactive, regardless of streak", () => {
    for (const days of [0, 3, 5, 10, 15, 20, 50]) {
      expect(streakBoostMultiplier(days, false)).toBe(1);
    }
  });

  it("returns 1× on summer days when streak < 5", () => {
    for (const days of [0, 1, 2, 3, 4]) {
      expect(streakBoostMultiplier(days, true)).toBe(1);
    }
  });

  it("steps up by +0.5× per 5-day streak on summer days", () => {
    expect(streakBoostMultiplier(5, true)).toBe(1.5);
    expect(streakBoostMultiplier(9, true)).toBe(1.5);
    expect(streakBoostMultiplier(10, true)).toBe(2);
    expect(streakBoostMultiplier(15, true)).toBe(2.5);
  });

  it("caps at 3× even for very long streaks", () => {
    expect(streakBoostMultiplier(20, true)).toBe(3);
    expect(streakBoostMultiplier(25, true)).toBe(3);
    expect(streakBoostMultiplier(100, true)).toBe(3);
    expect(streakBoostMultiplier(365, true)).toBe(3);
  });
});

describe("Push 83 — awardSticker wiring (source-level)", () => {
  it("declares streakBoostMultiplier in the return shape", () => {
    // The function body must expose the multiplier so the kid-facing UI
    // can show "+2× boost!" without re-computing from outside.
    expect(DB_TS).toMatch(/streakBoostMultiplier,?\s*\n/);
    expect(DB_TS).toMatch(/baseCoins,?\s*\n/);
    expect(DB_TS).toMatch(/streakDays,?\s*\n/);
    expect(DB_TS).toMatch(/summerActive,?\s*\n/);
  });

  it("imports the pure streak helper", () => {
    expect(DB_TS).toMatch(/_lib\/completionStreak/);
    expect(DB_TS).toMatch(/dailyBlockCompletionStreak/);
  });

  it("imports summerMode helpers", () => {
    expect(DB_TS).toMatch(/from\s+["']\.\/summerMode["']|import\(["']\.\/summerMode["']\)/);
    expect(DB_TS).toMatch(/effectiveSummerActive/);
    expect(DB_TS).toMatch(/streakBoostMultiplier/);
    expect(DB_TS).toMatch(/summerSettingsFromKv/);
  });

  it("applies the multiplier with Math.round (no fractional coins ever)", () => {
    expect(DB_TS).toMatch(/Math\.round\(baseCoins\s*\*\s*streakBoostMultiplier\)/);
  });

  it("guards the boost path with try/catch so awards never fail soft", () => {
    // Look for the immediate catch swallow comment we deliberately added.
    expect(DB_TS).toMatch(/boost is best-effort/);
  });

  it("only applies boost when summer is active (gated by `if (summerActive)`)", () => {
    expect(DB_TS).toMatch(/if\s*\(\s*summerActive\s*\)/);
  });

  it("includes today in the streak day-list before computing (we're about to insert)", () => {
    expect(DB_TS).toMatch(/dayList\.push\(today\)/);
  });
});

describe("Push 83 — pure helper file shape", () => {
  it("exports the three required helpers", () => {
    expect(STREAK_TS).toMatch(/export\s+function\s+dailyBlockCompletionStreak/);
    expect(STREAK_TS).toMatch(/export\s+function\s+previousIsoDay/);
    expect(STREAK_TS).toMatch(/export\s+function\s+shiftIsoDay/);
  });
});
