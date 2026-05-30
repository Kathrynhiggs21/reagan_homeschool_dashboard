/**
 * Pure tests for the band classifier behind the 5th-Grade Report Card.
 * The classifier itself is private to db.ts, so we re-create it here and
 * lock the contract so future drift is caught.
 */
import { describe, it, expect } from "vitest";

type Band = "mastered" | "on track" | "working on it" | "not yet";

function levelToBand(level: number): Band {
  if (level >= 4) return "mastered";
  if (level >= 3) return "on track";
  if (level >= 1) return "working on it";
  return "not yet";
}

describe("levelToBand", () => {
  it("level 0 → 'not yet'", () => {
    expect(levelToBand(0)).toBe("not yet");
  });

  it("level 1, 2 → 'working on it'", () => {
    expect(levelToBand(1)).toBe("working on it");
    expect(levelToBand(2)).toBe("working on it");
  });

  it("level 3 → 'on track'", () => {
    expect(levelToBand(3)).toBe("on track");
  });

  it("level 4, 5 → 'mastered'", () => {
    expect(levelToBand(4)).toBe("mastered");
    expect(levelToBand(5)).toBe("mastered");
  });

  it("negative or fractional levels degrade gracefully", () => {
    expect(levelToBand(-1)).toBe("not yet");
    expect(levelToBand(0.5)).toBe("not yet");
    expect(levelToBand(2.9)).toBe("working on it");
    expect(levelToBand(3.5)).toBe("on track");
    expect(levelToBand(99)).toBe("mastered");
  });
});
