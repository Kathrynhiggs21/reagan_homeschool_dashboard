/**
 * Overnight push 2026-05-14 — Kiwi mood/behavior tracker contract.
 */
import { describe, it, expect } from "vitest";
import {
  readKiwiMoodForBlock,
  rollUpDayMood,
  type KiwiBlockSignals,
  type KiwiMoodReading,
} from "./_lib/kiwiMoodTracker";

const baseSignals: KiwiBlockSignals = {
  blockSortOrder: 1,
  blockTitle: "Math",
  subjectName: "Math",
  micFocusFraction: 0.8,
  micDistressFraction: 0.05,
  onTaskEvents: 30,
  scheduledMinutes: 30,
  elapsedMinutes: 20,
};

describe("readKiwiMoodForBlock", () => {
  it("returns 'great' band for high focus + low distress", () => {
    const r = readKiwiMoodForBlock({ ...baseSignals });
    expect(r.band).toBe("great");
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.headline).toBe("Reagan looks focused in Math.");
    expect(r.suggestedAdjustment).toBe("none");
  });

  it("returns 'frustrated' + end_block_now after halfway with high distress", () => {
    const r = readKiwiMoodForBlock({
      ...baseSignals,
      micFocusFraction: 0.2,
      micDistressFraction: 0.7,
      elapsedMinutes: 20,
      scheduledMinutes: 30,
    });
    expect(r.band).toBe("frustrated");
    expect(r.suggestedAdjustment).toBe("end_block_now");
    expect(r.headline).toContain("frustrated");
  });

  it("returns 'frustrated' + swap_to_movement before halfway", () => {
    const r = readKiwiMoodForBlock({
      ...baseSignals,
      micFocusFraction: 0.2,
      micDistressFraction: 0.6,
      elapsedMinutes: 5,
      scheduledMinutes: 30,
    });
    expect(r.band).toBe("frustrated");
    expect(r.suggestedAdjustment).toBe("swap_to_movement");
  });

  it("returns 'tired' + shorten_next on mid scores", () => {
    const r = readKiwiMoodForBlock({
      ...baseSignals,
      micFocusFraction: 0.45,
      micDistressFraction: 0.15,
      onTaskEvents: 8,
    });
    expect(r.band).toBe("tired");
    expect(r.suggestedAdjustment).toBe("shorten_next");
  });

  it("trusts focused signals less when block just started", () => {
    const r = readKiwiMoodForBlock({
      ...baseSignals,
      micFocusFraction: 0.1,
      micDistressFraction: 0.1,
      onTaskEvents: 0,
      elapsedMinutes: 2,
      scheduledMinutes: 30,
    });
    // First 25% — never go below 'okay'
    expect(["okay", "great"]).toContain(r.band);
  });

  it("penalizes long over-runs", () => {
    const r = readKiwiMoodForBlock({
      ...baseSignals,
      elapsedMinutes: 50, // 1.66x scheduled
      scheduledMinutes: 30,
    });
    expect(r.score).toBeLessThan(80);
  });

  it("penalizes when kid flags work as hard", () => {
    const a = readKiwiMoodForBlock({ ...baseSignals });
    const b = readKiwiMoodForBlock({ ...baseSignals, kidFlaggedHard: true });
    expect(b.score).toBeLessThan(a.score);
  });

  it("clamps weird input fractions safely", () => {
    const r = readKiwiMoodForBlock({
      ...baseSignals,
      micFocusFraction: 9 as any,
      micDistressFraction: -2 as any,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("rollUpDayMood", () => {
  it("falls back to 'no signals yet' when readings are empty", () => {
    const r = rollUpDayMood([]);
    expect(r.band).toBe("okay");
    expect(r.headline).toBe("No mood signals yet today.");
  });

  it("averages scores and uses the most-recent block's suggestion", () => {
    const a: KiwiMoodReading = {
      band: "great",
      score: 90,
      headline: "x",
      suggestion: "keep going",
      suggestedAdjustment: "none",
    };
    const b: KiwiMoodReading = {
      band: "tired",
      score: 50,
      headline: "y",
      suggestion: "make next shorter",
      suggestedAdjustment: "shorten_next",
    };
    const r = rollUpDayMood([a, b]);
    expect(r.score).toBe(70);
    expect(r.band).toBe("okay");
    expect(r.suggestion).toBe("make next shorter");
  });

  it("uses 'frustrated' + gentle headline when daily avg is very low", () => {
    const r = rollUpDayMood([
      {
        band: "frustrated",
        score: 20,
        headline: "x",
        suggestion: "stretch",
        suggestedAdjustment: "swap_to_movement",
      },
      {
        band: "frustrated",
        score: 30,
        headline: "y",
        suggestion: "wrap up",
        suggestedAdjustment: "end_block_now",
      },
    ]);
    expect(r.band).toBe("frustrated");
    expect(r.headline).toContain("hard day");
  });
});
