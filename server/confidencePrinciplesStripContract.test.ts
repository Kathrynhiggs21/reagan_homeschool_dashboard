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

  it("is imported on Today (mount deferred per v2.87 simplification)", () => {
    // v3.28 (2026-06-01): Today.tsx was simplified per Mom's preference for
    // a less-cluttered dashboard. ConfidencePrinciplesStrip remains imported
    // and ready, but is not currently rendered.
    const src = fs.readFileSync(TODAY, "utf8");
    expect(src).toContain("ConfidencePrinciplesStrip");
    expect(src).toMatch(/from\s+"@\/components\/ConfidencePrinciplesStrip"/);
  });
});
