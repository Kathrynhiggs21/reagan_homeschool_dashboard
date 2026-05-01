import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test: ensure the kid-readable Confidence Principles strip is
 * mounted on Today and that it ships exactly 4 principles (the "north star"
 * grid: feel safe / understand / grow / you ARE smart).
 */

const ROOT = path.resolve(__dirname, "..");
const STRIP = path.join(ROOT, "client/src/components/ConfidencePrinciplesStrip.tsx");
const TODAY = path.join(ROOT, "client/src/pages/Today.tsx");

describe("ConfidencePrinciplesStrip contract", () => {
  it("ships exactly the four core principles", () => {
    const src = fs.readFileSync(STRIP, "utf8");
    const shorts = ["Feel safe", "Understand", "Grow on purpose", "You ARE smart"];
    for (const s of shorts) expect(src).toContain(`short: "${s}"`);
  });

  it("is mounted on Today below the daily tip strip", () => {
    const src = fs.readFileSync(TODAY, "utf8");
    expect(src).toContain("ConfidencePrinciplesStrip");
    // Must come AFTER DailyTipAndFreshStart in the JSX tree
    const tipIdx = src.indexOf("<DailyTipAndFreshStart");
    const stripIdx = src.indexOf("<ConfidencePrinciplesStrip");
    expect(tipIdx).toBeGreaterThan(0);
    expect(stripIdx).toBeGreaterThan(tipIdx);
  });
});
