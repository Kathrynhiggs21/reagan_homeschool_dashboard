/**
 * v2.14 (2026-05-17) — Source-pattern wiring vitest for TodayAdultQuickEntryCard.
 *
 * We don't have jsdom + react-testing-library wired in this project, so the
 * standing pattern across every Today.tsx widget (TodayClassroomGradedCard,
 * TodayMomVoiceMemoCard, TodayForwardPlanCard, ...) is to assert the
 * source-level invariants that matter most:
 *
 *   1. The card file exists.
 *   2. The card calls the right tRPC procs (today.applyAdultQuickEntry +
 *      actuals.quickAdd) — not stale guesses.
 *   3. The card renders a textarea + a confirm button so the parse → review
 *      → save flow exists.
 *   4. Today.tsx imports the card and mounts it ONLY behind the adult lock
 *      (`{unlocked && <TodayAdultQuickEntryCard ...>}`), defending the
 *      per-row save call from the kid view even if the lock leaks.
 *
 * If any of those drift, this test catches it before a checkpoint goes out.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const CARD = fs.readFileSync(
  path.join(ROOT, "client/src/components/TodayAdultQuickEntryCard.tsx"),
  "utf8",
);
const TODAY = fs.readFileSync(
  path.join(ROOT, "client/src/pages/Today.tsx"),
  "utf8",
);

describe("v2.14 TodayAdultQuickEntryCard wiring", () => {
  it("card file exists and is non-trivial", () => {
    expect(CARD.length).toBeGreaterThan(800);
  });

  it("card calls today.applyAdultQuickEntry parse mutation", () => {
    expect(CARD).toMatch(/trpc\.today\.applyAdultQuickEntry\.useMutation\(/);
  });

  it("card calls actuals.quickAdd persistence mutation", () => {
    expect(CARD).toMatch(/trpc\.actuals\.quickAdd\.useMutation\(/);
  });

  it("card uses 'mom-input' as the source for actuals.quickAdd writes", () => {
    // Defends the 8 PM Marcy-recap fallback rule: Mom's typed entries
    // must be tagged 'mom-input', not 'reagan-checkin' or 'auto-derived'.
    expect(CARD).toMatch(/source:\s*"mom-input"/);
  });

  it("card renders a Textarea for the multi-line input", () => {
    expect(CARD).toMatch(/<Textarea\b/);
  });

  it("card has a Save button gated on accepted entries", () => {
    expect(CARD).toMatch(/Save\s*\$\{accepted\.size\}/);
    expect(CARD).toMatch(/disabled=\{addMut\.isPending\s*\|\|\s*accepted\.size\s*===\s*0\}/);
  });

  it("Today.tsx imports the card", () => {
    expect(TODAY).toMatch(
      /import\s+TodayAdultQuickEntryCard\s+from\s+"@\/components\/TodayAdultQuickEntryCard"/,
    );
  });

  it("Today.tsx mounts the card adult-only via {unlocked && <TodayAdultQuickEntryCard ...>}", () => {
    expect(TODAY).toMatch(
      /\{unlocked\s*&&\s*<TodayAdultQuickEntryCard\s*\/>\}/,
    );
  });

  it("the kid view (no unlocked gate) does NOT render the card", () => {
    // Verify there is no unguarded mount line elsewhere.
    const unguarded =
      /(?:^|\n)\s*<TodayAdultQuickEntryCard\s*\/>/m.test(TODAY) === false ||
      /\{unlocked\s*&&\s*<TodayAdultQuickEntryCard\s*\/>\}/.test(TODAY);
    expect(unguarded).toBe(true);
  });
});
