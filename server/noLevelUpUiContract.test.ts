import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Push 23 (2026-05-12): Lock down Mom's "no level-up notifications, badges,
 * XP" rule on Today/Analytics/Apps (todo.md lines 2418-2419).
 *
 * Confidence-first principle: leveling pressure is OFF on the kid surfaces.
 * Server-side `proudMoments.category=='levelUp'` rows are still allowed
 * because they only feed the adult-only WeeklyDigestCard (Mom's celebration
 * inbox), and the inline SkillBuilderTile "no level-up pressure" badge is
 * the *opposite* signal — it confirms pressure is OFF.
 */

const ROOT = path.join(__dirname, "..");
const TODAY = readFileSync(path.join(ROOT, "client/src/pages/Today.tsx"), "utf8");
const ANALYTICS = readFileSync(path.join(ROOT, "client/src/pages/Analytics.tsx"), "utf8");
const APPS_PATH = path.join(ROOT, "client/src/pages/Apps.tsx");
let APPS = "";
try { APPS = readFileSync(APPS_PATH, "utf8"); } catch { /* may be renamed */ }

function hasNoLevelUpBadge(src: string, label: string) {
  // We block: any UI rendering of "Level X", "Level-up", "Level Up", "XP", or "+X XP"
  const patterns = [
    /\bLevel\s+\d+\b/,           // "Level 5"
    /\bLevel[-\s]?[Uu]p\b(?!.*pressure)/,  // "Level Up" or "Level-up" (allow "no level-up pressure")
    /\b\+?\d+\s*XP\b/,           // "+50 XP"
    /\bXP\s+(earned|gained|points)/i,
  ];
  for (const p of patterns) {
    if (p.test(src)) {
      throw new Error(`${label} contains forbidden level-up pattern: ${p}`);
    }
  }
  return true;
}

describe("no level-up UI on kid surfaces — contract (push 23)", () => {
  it("Today.tsx has no Level X / Level-Up / XP rendering", () => {
    expect(hasNoLevelUpBadge(TODAY, "Today")).toBe(true);
  });

  it("Analytics.tsx has no Level X / Level-Up / XP rendering", () => {
    expect(hasNoLevelUpBadge(ANALYTICS, "Analytics")).toBe(true);
  });

  it("Apps.tsx (if present) has no Level X / Level-Up / XP rendering", () => {
    if (!APPS) {
      expect(true).toBe(true);
      return;
    }
    expect(hasNoLevelUpBadge(APPS, "Apps")).toBe(true);
  });

  it("kid Today still uses kiwi-coins for celebration (not XP)", () => {
    // Sanity check: the celebration mechanic IS still present, just under coins.
    expect(TODAY.toLowerCase()).toMatch(/coin|kiwi.coin/);
  });
});
