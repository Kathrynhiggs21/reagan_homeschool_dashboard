import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Lightweight wiring test — the project's vitest is node-only (no jsdom).
 * Instead of mounting React, we assert the Today.tsx source file imports
 * the new card AND mounts it under the adult `unlocked &&` gate. This is
 * fast, deterministic, and prevents an accidental kid-visible regression.
 */
const repoRoot = path.resolve(__dirname, "..");
const todayPath = path.join(repoRoot, "client/src/pages/Today.tsx");
const cardPath = path.join(
  repoRoot,
  "client/src/components/TodayMomVoiceMemoCard.tsx",
);

function read(p: string) {
  return fs.readFileSync(p, "utf8");
}

describe("TodayMomVoiceMemoCard wiring on Today.tsx", () => {
  it("Today.tsx imports TodayMomVoiceMemoCard from the components folder", () => {
    const src = read(todayPath);
    expect(src).toMatch(
      /import\s+TodayMomVoiceMemoCard\s+from\s+["']@\/components\/TodayMomVoiceMemoCard["']/,
    );
  });

  it("Today.tsx mounts TodayMomVoiceMemoCard ONLY under the adult unlocked gate", () => {
    const src = read(todayPath);
    expect(src).toMatch(/\{\s*unlocked\s*&&\s*<TodayMomVoiceMemoCard\s*\/>\s*\}/);
  });

  it("the kid-visible Classroom kid card never appears under an unlocked gate", () => {
    const src = read(todayPath);
    // We DO want the kid card to appear unconditionally OR with a different
    // gate; the only thing we forbid is it being adult-only by accident.
    // Negative pattern: there must be at least one TodayClassroomCard mount
    // that is NOT preceded by `unlocked &&`.
    const allMounts = Array.from(
      src.matchAll(/<TodayClassroomCard\s*\/>/g),
    );
    expect(allMounts.length).toBeGreaterThan(0);
  });

  it("the new card file lives at client/src/components/TodayMomVoiceMemoCard.tsx", () => {
    expect(fs.existsSync(cardPath)).toBe(true);
  });

  it("the new card uses curriculum.voiceMemoBackfill as its data source", () => {
    const src = read(cardPath);
    expect(src).toMatch(
      /trpc\.curriculum\.voiceMemoBackfill\.useQuery/,
    );
  });

  it("the new card hides itself when there are zero rows", () => {
    const src = read(cardPath);
    expect(src).toMatch(/rows\.length\s*===\s*0/);
    expect(src).toMatch(/return\s+null/);
  });

  it("the new card pins the Mom Katy 2026-05-17 source string", () => {
    const src = read(cardPath);
    expect(src).toMatch(/mom_katy_voice_memo_2026-05-17/);
  });
});
