import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Daily Playlist's color rotation must vary by weekday so the row
 * colors don't feel stuck on the same hue forever.
 */
describe("daily-shuffle seed", () => {
  const src = readFileSync(
    join(__dirname, "..", "client", "src", "lib", "subjectColors.ts"),
    "utf8",
  );

  it("daySeed uses getDay() for weekday rotation", () => {
    expect(src).toMatch(/function\s+daySeed[\s\S]*?d\.getDay\(\)/);
  });

  it("rainbowStop applies the daySeed offset", () => {
    expect(src).toMatch(/const offset = daySeed\(date\);/);
    expect(src).toMatch(/\(\(index \+ offset\)/);
  });

  it("RAINBOW palette has at least 7 stops so rotation visibly changes daily", () => {
    const m = src.match(/export const RAINBOW: RainbowStop\[\] = \[([\s\S]*?)\];/);
    expect(m).toBeTruthy();
    const stops = (m![1].match(/\{ name:/g) || []).length;
    expect(stops).toBeGreaterThanOrEqual(7);
  });
});
