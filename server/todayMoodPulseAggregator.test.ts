import { describe, it, expect } from "vitest";
import {
  aggregateMoodPulses,
  __FOR_TEST__,
  type MoodSample,
} from "./_lib/todayMoodPulseAggregator";

const day = (h: number, mood: MoodSample["mood"]): MoodSample => ({
  mood,
  isoTimestamp: `2026-05-14T${String(h).padStart(2, "0")}:00:00Z`,
});

describe("Push 203 — todayMoodPulseAggregator", () => {
  it("returns null/empty result for no samples", () => {
    const r = aggregateMoodPulses([]);
    expect(r.count).toBe(0);
    expect(r.dominant).toBeNull();
    expect(r.latest).toBeNull();
    expect(r.adultGentleCheckIn).toBe(false);
    expect(r.kidHeadline.length).toBeGreaterThan(0);
  });

  it("counts samples accurately", () => {
    const r = aggregateMoodPulses([day(8, "happy"), day(12, "calm"), day(15, "happy")]);
    expect(r.count).toBe(3);
  });

  it("dominant mood is the most-frequent", () => {
    const r = aggregateMoodPulses([
      day(8, "happy"),
      day(10, "happy"),
      day(12, "calm"),
    ]);
    expect(r.dominant).toBe("happy");
  });

  it("dominant tie-break: most-recent wins", () => {
    const r = aggregateMoodPulses([day(8, "happy"), day(12, "calm")]);
    expect(r.dominant).toBe("calm");
  });

  it("latest mood reflects last timestamp", () => {
    const r = aggregateMoodPulses([
      day(8, "calm"),
      day(15, "tired"),
      day(11, "focused"),
    ]);
    expect(r.latest).toBe("tired");
  });

  it("kidHeadline is anchored to the latest mood", () => {
    const r = aggregateMoodPulses([day(8, "happy"), day(15, "tired")]);
    expect(r.kidHeadline).toBe(__FOR_TEST__.KID_LINES["tired"]);
  });

  it("kidHeadline is never punitive even on a sad day", () => {
    const r = aggregateMoodPulses([day(8, "sad"), day(12, "sad")]);
    const FORBIDDEN = ["bad", "lazy", "stop", "shouldn", "punish"];
    for (const w of FORBIDDEN) {
      expect(r.kidHeadline.toLowerCase()).not.toContain(w);
    }
  });

  it("adultGentleCheckIn flips true when same low mood >=2 in last 4", () => {
    const r = aggregateMoodPulses([
      day(8, "happy"),
      day(10, "happy"),
      day(12, "frustrated"),
      day(14, "frustrated"),
    ]);
    expect(r.adultGentleCheckIn).toBe(true);
    expect(r.adultNote.length).toBeGreaterThan(0);
  });

  it("adultGentleCheckIn stays false when low moods don't repeat", () => {
    const r = aggregateMoodPulses([
      day(8, "happy"),
      day(10, "tired"),
      day(12, "happy"),
      day(14, "frustrated"),
    ]);
    expect(r.adultGentleCheckIn).toBe(false);
    expect(r.adultNote).toBe("");
  });

  it("adultNote names the specific low mood when flagged", () => {
    const r = aggregateMoodPulses([day(8, "sad"), day(10, "sad")]);
    expect(r.adultNote).toContain("sad");
  });

  it("only considers the last 4 samples for the gentle-check-in", () => {
    const r = aggregateMoodPulses([
      day(7, "sad"),
      day(8, "sad"),
      day(9, "happy"),
      day(10, "happy"),
      day(11, "happy"),
      day(12, "calm"),
    ]);
    expect(r.adultGentleCheckIn).toBe(false);
  });

  it("output is deterministic for same input", () => {
    const samples = [day(8, "happy"), day(12, "calm"), day(15, "tired")];
    const a = aggregateMoodPulses(samples);
    const b = aggregateMoodPulses(samples);
    expect(a).toEqual(b);
  });

  it("does not mutate input array", () => {
    const samples: MoodSample[] = [
      day(15, "tired"),
      day(8, "happy"),
      day(12, "calm"),
    ];
    const before = JSON.stringify(samples);
    aggregateMoodPulses(samples);
    expect(JSON.stringify(samples)).toBe(before);
  });

  it("handles unsorted timestamps correctly", () => {
    const r = aggregateMoodPulses([
      day(15, "tired"),
      day(8, "happy"),
      day(11, "frustrated"),
    ]);
    expect(r.latest).toBe("tired");
  });

  it("POSITIVE list contains exactly the three kid-positive moods", () => {
    expect(__FOR_TEST__.POSITIVE).toEqual(["happy", "calm", "focused"]);
  });

  it("LOW list contains exactly the three kid-low moods", () => {
    expect(__FOR_TEST__.LOW).toEqual(["tired", "frustrated", "sad"]);
  });

  it("KID_LINES has a non-empty string for every mood", () => {
    for (const m of [...__FOR_TEST__.POSITIVE, ...__FOR_TEST__.LOW]) {
      expect(__FOR_TEST__.KID_LINES[m].length).toBeGreaterThan(0);
    }
  });

  it("a single-sample day produces a valid summary", () => {
    const r = aggregateMoodPulses([day(8, "calm")]);
    expect(r.count).toBe(1);
    expect(r.latest).toBe("calm");
    expect(r.dominant).toBe("calm");
    expect(r.adultGentleCheckIn).toBe(false);
  });

  it("low + positive mix in last 4 doesn't flag if low only appears once", () => {
    const r = aggregateMoodPulses([
      day(9, "happy"),
      day(10, "calm"),
      day(11, "tired"),
      day(12, "happy"),
    ]);
    expect(r.adultGentleCheckIn).toBe(false);
  });

  it("kidHeadline for empty samples encourages but doesn't pressure", () => {
    const r = aggregateMoodPulses([]);
    expect(r.kidHeadline.toLowerCase()).toContain("when you want");
  });
});
