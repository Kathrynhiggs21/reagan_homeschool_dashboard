/**
 * Source-level guard: wellnessScore() in db.ts must consume
 * anxietyContributionFromZones() from the canonical warningZones lib.
 * If anyone reverts to the legacy `reds * 30 + yellows * 15` math, this fails.
 *
 * Plus a numeric smoke test of anxietyContributionFromZones() to lock in
 * the doc weights (green=0, yellow=15, red=30, black=60, capped at 100).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { anxietyContributionFromZones } from "./_lib/warningZones";

const dbSrc = readFileSync(resolve(__dirname, "db.ts"), "utf8");

describe("wellnessScore wires the canonical Color-Coded Warning Zones", () => {
  it("imports anxietyContributionFromZones from _lib/warningZones", () => {
    expect(dbSrc).toContain('from "./_lib/warningZones"');
    expect(dbSrc).toContain("anxietyContributionFromZones");
  });

  it("does NOT contain the legacy hard-coded `reds * 30 + yellows * 15` formula in code (comment is allowed)", () => {
    // Strip out single-line comments, block comments, and JSDoc so the
    // historical-context comment in db.ts (`replaced legacy reds*30 + yellows*15`)
    // doesn't false-trigger this assertion.
    const noLineComments = dbSrc.replace(/\/\/[^\n]*/g, "");
    const noBlockComments = noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
    const compact = noBlockComments.replace(/\s+/g, " ");
    expect(compact).not.toContain("reds * 30 + yellows * 15");
    expect(compact).not.toContain("reds*30 + yellows*15");
  });

  it("calls anxietyContributionFromZones inside wellnessScore body", () => {
    // Find the wellnessScore function and confirm the call sits inside it.
    const idx = dbSrc.indexOf("export async function wellnessScore");
    expect(idx).toBeGreaterThan(-1);
    const tail = dbSrc.slice(idx, idx + 4000);
    expect(tail).toContain("anxietyContributionFromZones(observedZones)");
  });
});

describe("anxietyContributionFromZones numeric weights match the canonical doc", () => {
  it("green contributes 0", () => {
    expect(anxietyContributionFromZones(["green", "green", "green"])).toBe(0);
  });
  it("yellow contributes 15 each", () => {
    expect(anxietyContributionFromZones(["yellow"])).toBe(15);
    expect(anxietyContributionFromZones(["yellow", "yellow"])).toBe(30);
  });
  it("red contributes 30 each", () => {
    expect(anxietyContributionFromZones(["red"])).toBe(30);
    expect(anxietyContributionFromZones(["red", "red"])).toBe(60);
  });
  it("black contributes 60 each", () => {
    expect(anxietyContributionFromZones(["black"])).toBe(60);
  });
  it("caps at 100", () => {
    expect(anxietyContributionFromZones(["red", "red", "red", "red"])).toBe(100);
    expect(anxietyContributionFromZones(["black", "black", "red"])).toBe(100);
  });
});
