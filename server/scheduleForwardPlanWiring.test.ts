import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Push 2.11 (2026-05-17) — Source-pattern wiring lock for Schedule.tsx.
 *
 * Confirms the adult-only TodayForwardPlanCard is mounted on the Schedule
 * page, gated by `unlocked` from useAdultLock, with a stable import path.
 */

const ROOT = resolve(__dirname, "..");
const schedulePath = resolve(ROOT, "client/src/pages/Schedule.tsx");

describe("Schedule.tsx forward-plan wiring", () => {
  it("imports TodayForwardPlanCard from @/components", () => {
    const src = readFileSync(schedulePath, "utf8");
    expect(src).toMatch(
      /import\s+TodayForwardPlanCard\s+from\s+["']@\/components\/TodayForwardPlanCard["'];?/,
    );
  });

  it("mounts the card behind the unlocked gate", () => {
    const src = readFileSync(schedulePath, "utf8");
    expect(src).toMatch(/\{unlocked\s*&&\s*<TodayForwardPlanCard\s*\/>\}/);
  });

  it("the unlocked flag is sourced from useAdultLock", () => {
    const src = readFileSync(schedulePath, "utf8");
    expect(src).toMatch(/const\s*\{\s*unlocked\s*\}\s*=\s*useAdultLock\(\)/);
  });
});
