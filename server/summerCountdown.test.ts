import { describe, it, expect } from "vitest";
import { daysUntilSummerBreak } from "../client/src/lib/summerCountdown";

describe("daysUntilSummerBreak", () => {
  it("returns positive days before June 5 in the same school year", () => {
    expect(daysUntilSummerBreak(new Date(2026, 4, 1))).toBe(35); // May 1 -> June 5
  });
  it("flips to next June after the break passes", () => {
    expect(daysUntilSummerBreak(new Date(2026, 6, 1))).toBeGreaterThan(300);
  });
  it("zero or negative on/after the target", () => {
    expect(daysUntilSummerBreak(new Date(2026, 5, 5))).toBeLessThanOrEqual(0);
  });
});
