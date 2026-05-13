/**
 * Push 81 (2026-05-13) — Analytics mood-ring visual contract.
 *
 * The component is presentational; we lock its structural invariants by
 * reading the source file so vitest catches drift even without a DOM:
 *
 *   1. Component is mounted on Analytics.tsx in the visual row.
 *   2. Reads trpc.today.moodStrip with days: 7.
 *   3. Self-hides when every day in the window has zone=null (no-info rule).
 *   4. Palette matches the existing kid + adult mood strips so adults
 *      learn one color key once.
 *   5. SVG geometry uses 7 segments via describeSegment helper.
 *   6. data-mood-ring attribute is present so downstream tests/skins can
 *      target it without coupling to internals.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const COMP_SRC = readFileSync(
  join(process.cwd(), "client/src/components/MoodRing.tsx"),
  "utf-8",
);
const ANALYTICS_SRC = readFileSync(
  join(process.cwd(), "client/src/pages/Analytics.tsx"),
  "utf-8",
);
const KID_STRIP_SRC = readFileSync(
  join(process.cwd(), "client/src/components/KidHeaderStrips.tsx"),
  "utf-8",
);

describe("Push 81 — Mood ring on Analytics", () => {
  it("MoodRing is imported on Analytics.tsx", () => {
    expect(ANALYTICS_SRC).toMatch(/from\s+"@\/components\/MoodRing"/);
  });

  it("MoodRing is mounted in Analytics body (not just imported)", () => {
    expect(ANALYTICS_SRC).toMatch(/<MoodRing\s*\/>/);
  });

  it("reads trpc.today.moodStrip with a 7-day window", () => {
    expect(COMP_SRC).toMatch(/trpc\.today\.moodStrip\.useQuery\(\s*\{\s*days:\s*7\s*\}\s*\)/);
  });

  it("self-hides when every day's zone is null/undefined", () => {
    expect(COMP_SRC).toMatch(/some\(.*zone\s*!==\s*null/s);
    expect(COMP_SRC).toMatch(/if\s*\(!hasAny\)\s*return\s*null/);
  });

  it("self-hides while loading and when no rows are returned", () => {
    expect(COMP_SRC).toMatch(/if\s*\(isLoading\)\s*return\s*null/);
    expect(COMP_SRC).toMatch(/if\s*\(!data\s*\|\|\s*data\.length\s*===\s*0\)\s*return\s*null/);
  });

  it("uses the shared mood palette (green/yellow/red/blue/gray + cream no-log)", () => {
    expect(COMP_SRC).toMatch(/"green":\s*return\s*"#22c55e"/);
    expect(COMP_SRC).toMatch(/"yellow":\s*return\s*"#eab308"/);
    expect(COMP_SRC).toMatch(/"red":\s*return\s*"#ef4444"/);
    // Cream "no log" color matches the one used by KidHeaderStrips so
    // adults learn one color key once.
    expect(COMP_SRC).toMatch(/#d1c8b3/);
    expect(KID_STRIP_SRC).toMatch(/#d1c8b3/);
  });

  it("renders one SVG segment per day via describeSegment", () => {
    expect(COMP_SRC).toMatch(/function\s+describeSegment\s*\(/);
    expect(COMP_SRC).toMatch(/d=\{describeSegment\(i,\s*ordered\.length\)\}/);
  });

  it("orders segments oldest-first so the ring reads clockwise from top", () => {
    expect(COMP_SRC).toMatch(/data\.slice\(\)\.reverse\(\)/);
  });

  it("center label counts good days (green) and pluralizes correctly", () => {
    expect(COMP_SRC).toMatch(/counts\.good\s*\+\+/);
    expect(COMP_SRC).toMatch(/good day\$\{counts\.good === 1 \? "" : "s"\}/);
  });

  it("carries data-mood-ring attribute on its root Card", () => {
    expect(COMP_SRC).toMatch(/data-mood-ring/);
  });

  it("provides per-segment <title> tooltip with date + label for hover", () => {
    expect(COMP_SRC).toMatch(/<title>\{`\$\{formatDate\(d\.date\)\}\s*—\s*\$\{zoneLabel/);
  });

  it("includes a legend covering all five mood zones + no-log", () => {
    for (const label of ["Good", "Okay", "Rough", "Quiet", "Tired", "No log"]) {
      expect(COMP_SRC).toMatch(new RegExp(`label="${label}"`));
    }
  });
});
