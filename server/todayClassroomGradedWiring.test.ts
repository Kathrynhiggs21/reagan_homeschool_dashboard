/**
 * todayClassroomGradedWiring.test.ts
 *
 * Source-pattern test that locks the Today.tsx mount of the new
 * adult-only "Recently graded" Classroom widget. We don't have jsdom in
 * the test runner, so this test reads the file as text and asserts the
 * contracts that matter for the kid-vs-adult separation:
 *
 *   1. The component is imported from the components/ directory.
 *   2. It's mounted INSIDE the `{unlocked && ...}` adult gate, not
 *      outside it. This is the contract that keeps the grade view off
 *      Reagan's screen even if the adult lock state were buggy.
 *   3. There's exactly ONE mount of TodayClassroomGradedCard so a
 *      future refactor can't accidentally double-mount it.
 *   4. The component file itself uses the familyAdmin-gated procedure
 *      `recentlyGraded`, not the kid-safe `activeForToday`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TODAY = resolve(__dirname, "../client/src/pages/Today.tsx");
const CARD = resolve(
  __dirname,
  "../client/src/components/TodayClassroomGradedCard.tsx",
);

const todaySrc = readFileSync(TODAY, "utf8");
const cardSrc = readFileSync(CARD, "utf8");

describe("Today.tsx wires TodayClassroomGradedCard adult-only", () => {
  it("imports TodayClassroomGradedCard from components/", () => {
    expect(todaySrc).toMatch(
      /import\s+TodayClassroomGradedCard\s+from\s+["']@\/components\/TodayClassroomGradedCard["']/,
    );
  });

  it("mounts the card exactly once", () => {
    const m = todaySrc.match(/<TodayClassroomGradedCard\s*\/>/g) ?? [];
    expect(m.length).toBe(1);
  });

  it("mount is gated behind {unlocked && ...}", () => {
    // Look for the literal pattern "{unlocked && <TodayClassroomGradedCard />}"
    // allowing for whitespace differences.
    expect(todaySrc).toMatch(
      /\{\s*unlocked\s*&&\s*<TodayClassroomGradedCard\s*\/>\s*\}/,
    );
  });

  it("kid-facing TodayClassroomCard is NOT inside an adult-gate", () => {
    // Sanity: the kid card must remain ungated, otherwise we'd be hiding
    // Reagan's own assignments from her by accident.
    const m = todaySrc.match(/<TodayClassroomCard\s*\/>/g) ?? [];
    expect(m.length).toBe(1);
    // The kid card line should NOT be preceded by `{unlocked && ` on the same line.
    const idx = todaySrc.indexOf("<TodayClassroomCard />");
    const lineStart = todaySrc.lastIndexOf("\n", idx);
    const line = todaySrc.slice(lineStart, idx);
    expect(line).not.toMatch(/\{\s*unlocked\s*&&/);
  });
});

describe("TodayClassroomGradedCard component contract", () => {
  it("calls the adult-only `recentlyGraded` procedure (not the kid-safe one)", () => {
    expect(cardSrc).toMatch(
      /trpc\.gclassroom\.assignments\.recentlyGraded\.useQuery\b/,
    );
    // Must NOT call activeForToday — that's the kid feed.
    expect(cardSrc).not.toMatch(/activeForToday\.useQuery/);
  });

  it("hides itself when the result is empty (no grey-box placeholder)", () => {
    expect(cardSrc).toMatch(/rows\.length\s*===\s*0/);
    expect(cardSrc).toMatch(/return\s+null/);
  });

  it("renders the grade pill for each row", () => {
    expect(cardSrc).toMatch(/today-classroom-graded-grade-/);
  });
});
