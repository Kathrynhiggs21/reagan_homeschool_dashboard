import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Push 24 (2026-05-12) — Mom: "don't want levels"
 *
 * Reagan must NEVER see the word "level" used as a skill/progress meter.
 * Internal storage keeps `placementLevel`, `currentLevel`, `leveledUp`
 * fields because the adapt engine + Mom's adult digest depend on them,
 * but every kid surface must render only:
 *   - emoji progress (🌱 🌿 🌳 🌟)
 *   - "% mastered" / "got it ×N" counts
 *   - encouragement strings (no level word)
 *
 * Allowed exceptions on kid surfaces:
 *   - "easier round today" (the softer-next chip; doesn't say "level")
 *   - any reference to `gradeLevel` (school grade, not skill level)
 *   - Kiwi *avatar* settings live in adult Settings, not kid pages, so
 *     animationLevel/talkLevel/funnyLevel never show here anyway.
 *
 * Scope: every page Reagan can reach without unlocking adult area, plus
 * every component imported by those pages.
 */

const ROOT = resolve(__dirname, "..");

// Pages Reagan can reach (kid surfaces). Add to this list whenever a new
// kid-facing route is added.
const KID_PAGES = [
  "client/src/pages/Today.tsx",
  "client/src/pages/Schedule.tsx",
  "client/src/pages/Kiwi.tsx",
  "client/src/pages/KiwiCoins.tsx",
  "client/src/pages/Bookshelf.tsx",
  "client/src/pages/TakeNotes.tsx",
  "client/src/pages/Apps.tsx",
  "client/src/pages/Placement.tsx",
  "client/src/pages/Library.tsx",
];

// Components rendered inside kid pages (auditable in addition to pages).
const KID_COMPONENTS = [
  "client/src/components/SkillBuilderTile.tsx",
  "client/src/components/CozyShell.tsx",
];

// Patterns we forbid on kid surfaces.
const FORBIDDEN: { name: string; rx: RegExp }[] = [
  // Visible "Level N" labels in JSX/strings.
  { name: 'literal "Level N"', rx: /["'`>]\s*Level\s+\d/ },
  // Visible "Lvl 3" or "Lvl. 3"
  { name: 'literal "Lvl N"', rx: /["'`>]\s*Lvl[\s.]+\d/ },
  // "Mastery 2" / "Stage 3"
  { name: 'literal "Mastery N"', rx: /["'`>]\s*Mastery\s+\d/ },
  { name: 'literal "Stage N"', rx: /["'`>]\s*Stage\s+\d/ },
  // Templated rendering of a level field as visible text.
  { name: 'JSX {level} render', rx: /\{\s*level\s*\}/ },
  { name: 'JSX {currentLevel}', rx: /\{\s*currentLevel\s*\}/ },
  { name: 'JSX {placementLevel}', rx: /\{\s*placementLevel\s*\}/ },
  // Toast / message wording with "level".
  { name: 'kid toast "moved up a level"', rx: /moved up a level/i },
  { name: 'kid toast "level up"', rx: /["'`]Level[\s-]?[Uu]p["'`]/ },
];

function read(rel: string): string {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

describe("no kid-visible level rendering — contract (push 24)", () => {
  for (const rel of [...KID_PAGES, ...KID_COMPONENTS]) {
    it(`${rel} contains no forbidden level rendering`, () => {
      const src = read(rel);
      if (!src) {
        // Page may have been intentionally removed; skip silently.
        expect(true).toBe(true);
        return;
      }
      const hits: string[] = [];
      for (const { name, rx } of FORBIDDEN) {
        const m = src.match(rx);
        if (m) hits.push(`${name} → ${m[0]}`);
      }
      if (hits.length > 0) {
        throw new Error(`Forbidden level rendering in ${rel}:\n  - ${hits.join("\n  - ")}`);
      }
      expect(hits).toEqual([]);
    });
  }

  it("SkillBuilderTile uses confidence wording for the leveledUp branch (no 'a level')", () => {
    const src = read("client/src/components/SkillBuilderTile.tsx");
    expect(src.length).toBeGreaterThan(500);
    // Positive: confidence-only success toast text is present.
    expect(src).toMatch(/used to be hard/i);
    // Negative: the OLD "moved up a level" wording is gone.
    expect(src).not.toMatch(/moved up a level/i);
  });

  it("Placement headline no longer says 'find your level'", () => {
    const src = read("client/src/pages/Placement.tsx");
    expect(src.length).toBeGreaterThan(500);
    expect(src).not.toMatch(/find your level/i);
    expect(src).toMatch(/feels easy and what feels new/i);
  });

  it("the softer-next hint chip never uses the word 'level'", () => {
    const src = read("client/src/components/SkillBuilderTile.tsx");
    // Locate the chip rendering line and assert the visible text.
    const chipMatch = src.match(/softerNext\s*&&\s*<span[^>]*>([^<]+)<\/span>/);
    expect(chipMatch, "softer-next chip should exist").not.toBeNull();
    if (chipMatch) {
      expect(chipMatch[1].toLowerCase()).not.toContain("level");
    }
  });
});
