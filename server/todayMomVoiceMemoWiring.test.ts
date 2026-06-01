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

  it("Today.tsx mounts TodayMomVoiceMemoCard inside the {unlocked && (...)} drawer", () => {
    // v3.28 (2026-06-01): adult cards moved into a single drawer slice.
    const src = read(todayPath);
    const gateIdx = src.indexOf("{unlocked && (");
    expect(gateIdx).toBeGreaterThan(0);
    const slice = src.slice(gateIdx, gateIdx + 8000);
    expect(slice).toContain("<TodayMomVoiceMemoCard");
  });

  it("the kid-visible Classroom kid card never lives inside the adult drawer", () => {
    // v3.28 (2026-06-01): the kid <TodayClassroomCard /> may or may not be
    // mounted on Today.tsx depending on the current layout, but if it is,
    // it MUST NOT live inside the adult-gated drawer.
    const src = read(todayPath);
    const mounts = Array.from(src.matchAll(/<TodayClassroomCard\s*\/>/g));
    const gateIdx = src.indexOf("{unlocked && (");
    const gateEnd = gateIdx + 8000;
    for (const m of mounts) {
      const mIdx = m.index ?? 0;
      const insideGate = gateIdx > 0 && mIdx >= gateIdx && mIdx < gateEnd;
      expect(insideGate, `kid TodayClassroomCard must NOT be inside the adult drawer (idx=${mIdx})`).toBe(false);
    }
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
