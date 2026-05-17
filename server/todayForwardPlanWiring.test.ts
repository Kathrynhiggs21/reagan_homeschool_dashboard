import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Source-pattern wiring lock for the adult-only TodayForwardPlanCard.
 *
 * Confirms:
 *  1. The component file exists.
 *  2. Today.tsx imports it.
 *  3. Today.tsx mounts it gated on `unlocked`.
 */

const ROOT = resolve(__dirname, "..");
const todayPath = resolve(ROOT, "client/src/pages/Today.tsx");
const cardPath = resolve(
  ROOT,
  "client/src/components/TodayForwardPlanCard.tsx",
);

describe("TodayForwardPlanCard wiring", () => {
  it("the card component file exists", () => {
    expect(existsSync(cardPath)).toBe(true);
  });

  it("Today.tsx imports TodayForwardPlanCard", () => {
    const src = readFileSync(todayPath, "utf8");
    expect(src).toMatch(
      /import\s+TodayForwardPlanCard\s+from\s+["']@\/components\/TodayForwardPlanCard["'];?/,
    );
  });

  it("Today.tsx mounts the card behind the unlocked gate", () => {
    const src = readFileSync(todayPath, "utf8");
    expect(src).toMatch(/\{unlocked\s*&&\s*<TodayForwardPlanCard\s*\/>\}/);
  });
});
