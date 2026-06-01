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

  it("mount is gated inside the {unlocked && (...)} adult drawer", () => {
    // v3.28 (2026-06-01): the adult-only cards moved inside a single
    // {unlocked && (<details>...</details>)} drawer rather than per-card
    // unlocked gates. The semantic contract still holds:
    // <TodayClassroomGradedCard /> mounts inside an unlocked-gated slice.
    const gateIdx = todaySrc.indexOf("{unlocked && (");
    expect(gateIdx).toBeGreaterThan(0);
    const slice = todaySrc.slice(gateIdx, gateIdx + 8000);
    expect(slice).toContain("<TodayClassroomGradedCard");
  });

  it("kid-facing TodayClassroomCard is NOT inside the adult drawer", () => {
    // v3.28 (2026-06-01): the kid <TodayClassroomCard /> may or may not be
    // mounted on Today.tsx depending on the current layout, but if it is,
    // it MUST NOT live inside the adult-gated drawer.
    const mounts = [...todaySrc.matchAll(/<TodayClassroomCard\s*\/>/g)];
    const gateIdx = todaySrc.indexOf("{unlocked && (");
    const gateEnd = gateIdx + 8000;
    for (const m of mounts) {
      const mIdx = m.index ?? 0;
      const insideGate = gateIdx > 0 && mIdx >= gateIdx && mIdx < gateEnd;
      expect(insideGate, `kid TodayClassroomCard must NOT be inside the adult drawer (idx=${mIdx})`).toBe(false);
    }
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
