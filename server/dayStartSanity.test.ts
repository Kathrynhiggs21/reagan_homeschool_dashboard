import { describe, it, expect } from "vitest";
import {
  hhmmToMin,
  minToHHMM,
  isLikelyAmPmCorruption,
  normalizeDayStart,
} from "./_lib/dayStartSanity";

describe("dayStartSanity — parsing helpers", () => {
  it("hhmmToMin parses valid times", () => {
    expect(hhmmToMin("10:00")).toBe(600);
    expect(hhmmToMin("09:30")).toBe(570);
    expect(hhmmToMin("23:30")).toBe(1410);
    expect(hhmmToMin("00:00")).toBe(0);
  });
  it("hhmmToMin rejects malformed / out-of-range", () => {
    expect(hhmmToMin(null)).toBeNull();
    expect(hhmmToMin("")).toBeNull();
    expect(hhmmToMin("24:00")).toBeNull();
    expect(hhmmToMin("10:70")).toBeNull();
    expect(hhmmToMin("flex")).toBeNull();
  });
  it("minToHHMM formats + wraps", () => {
    expect(minToHHMM(600)).toBe("10:00");
    expect(minToHHMM(1410)).toBe("23:30");
    expect(minToHHMM(-30)).toBe("23:30"); // wraps
    expect(minToHHMM(24 * 60)).toBe("00:00");
  });
});

describe("dayStartSanity — corruption detection", () => {
  it("flags an evening start as corruption (no intent)", () => {
    expect(isLikelyAmPmCorruption(22 * 60)).toBe(true); // 22:00
    expect(isLikelyAmPmCorruption(21 * 60)).toBe(true);
    expect(isLikelyAmPmCorruption(18 * 60)).toBe(true); // 18:00 boundary
  });
  it("does NOT flag a normal morning start", () => {
    expect(isLikelyAmPmCorruption(10 * 60)).toBe(false);
    expect(isLikelyAmPmCorruption(9 * 60)).toBe(false);
    expect(isLikelyAmPmCorruption(12 * 60)).toBe(false); // noon
    expect(isLikelyAmPmCorruption(13 * 60)).toBe(false); // 1pm afternoon ok
  });
  it("respects explicit evening intent", () => {
    expect(isLikelyAmPmCorruption(22 * 60, "movie night at 10pm")).toBe(false);
    expect(isLikelyAmPmCorruption(20 * 60, "evening review session")).toBe(false);
  });
  it("flags pre-dawn starts", () => {
    expect(isLikelyAmPmCorruption(4 * 60)).toBe(true); // 04:00
    expect(isLikelyAmPmCorruption(5 * 60)).toBe(false); // 05:00 ok
  });
  it("returns false for empty input", () => {
    expect(isLikelyAmPmCorruption(null)).toBe(false);
  });
});

describe("dayStartSanity — normalizeDayStart", () => {
  it("pulls a corrupted evening day back 12h, preserving spacing/order", () => {
    const day = [
      { startTime: "22:00", durationMin: 10 },
      { startTime: "22:10", durationMin: 30 },
      { startTime: "23:10", durationMin: 30 },
    ];
    const { items, corrected } = normalizeDayStart(day);
    expect(corrected).toBe(true);
    expect(items.map((b) => b.startTime)).toEqual(["10:00", "10:10", "11:10"]);
  });

  it("leaves a normal morning day untouched", () => {
    const day = [
      { startTime: "10:00", durationMin: 10 },
      { startTime: "12:00", durationMin: 60 },
      { startTime: "13:00", durationMin: 40 },
    ];
    const { items, corrected } = normalizeDayStart(day);
    expect(corrected).toBe(false);
    expect(items).toEqual(day);
  });

  it("does NOT shift a day where only a late appointment is timed but morning blocks exist", () => {
    // earliest timed is 09:00 → not corruption even though a 19:00 block exists
    const day = [
      { startTime: "09:00", durationMin: 30 },
      { startTime: "19:00", durationMin: 60 }, // legit evening event
    ];
    const { corrected } = normalizeDayStart(day);
    expect(corrected).toBe(false);
  });

  it("passes through untimed blocks unchanged while fixing timed ones", () => {
    const day = [
      { startTime: null, durationMin: 15 },
      { startTime: "21:00", durationMin: 30 },
      { startTime: "21:30", durationMin: 30 },
    ];
    const { items, corrected } = normalizeDayStart(day);
    expect(corrected).toBe(true);
    expect(items[0].startTime).toBeNull();
    expect(items[1].startTime).toBe("09:00");
    expect(items[2].startTime).toBe("09:30");
  });

  it("honors evening intent text and leaves times alone", () => {
    const day = [{ startTime: "20:00", durationMin: 30 }];
    const { corrected } = normalizeDayStart(day, "special evening study session");
    expect(corrected).toBe(false);
  });

  it("no-ops when nothing is timed", () => {
    const day = [{ startTime: null }, { startTime: null }];
    const { corrected } = normalizeDayStart(day);
    expect(corrected).toBe(false);
  });

  it("reproduces the exact 2026-06-18 bug → fix", () => {
    const day = [
      { startTime: "22:00", durationMin: 10 }, // Funny clip
      { startTime: "22:10", durationMin: 30 },
      { startTime: "22:40", durationMin: 30 },
      { startTime: "23:10", durationMin: 30 },
      { startTime: "12:00", durationMin: 60 }, // lunch already pm
      { startTime: "13:00", durationMin: 40 },
      { startTime: "13:40", durationMin: 30 },
    ];
    const { items, corrected } = normalizeDayStart(day);
    expect(corrected).toBe(true);
    // ONLY the corrupted leading morning run is fixed; the already-correct
    // afternoon (lunch 12:00, adventure 13:00, lab 13:40) is left untouched.
    expect(items.map((b) => b.startTime)).toEqual([
      "10:00", "10:10", "10:40", "11:10", "12:00", "13:00", "13:40",
    ]);
  });
});
