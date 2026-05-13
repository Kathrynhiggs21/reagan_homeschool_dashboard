/**
 * Push 104 (2026-05-13) — Listening-summary normalizer contract.
 */
import { describe, it, expect } from "vitest";
import {
  BEHAVIOR_VALUES,
  MOOD_VALUES,
  normalizeListeningSummary,
} from "./_lib/listeningSummaryNormalizer";

describe("Push 104 — listening-summary normalizer", () => {
  it("happy path: school chunk with Reagan voice counts toward coverage", () => {
    const r = normalizeListeningSummary({
      reaganVoicePresent: true,
      moodEstimate: "engaged",
      behaviorTags: ["focused", "asking-questions"],
      contentClassifier: "lesson",
    });
    expect(r).toEqual({
      reaganVoicePresent: true,
      moodEstimate: "engaged",
      behaviorTags: ["focused", "asking-questions"],
      contentClassifier: "lesson",
      countsTowardCoverage: true,
    });
  });

  it("does NOT count toward coverage when Reagan voice absent (mood still recorded)", () => {
    const r = normalizeListeningSummary({
      reaganVoicePresent: false,
      moodEstimate: "tired",
      behaviorTags: ["distracted"],
      contentClassifier: "lesson",
    });
    expect(r.countsTowardCoverage).toBe(false);
    expect(r.moodEstimate).toBe("tired");
    expect(r.behaviorTags).toEqual(["distracted"]);
  });

  it("does NOT count when classifier is non-school (off-topic / tv / silence)", () => {
    for (const c of ["off-topic", "tv", "silence"] as const) {
      const r = normalizeListeningSummary({
        reaganVoicePresent: true,
        moodEstimate: "silly",
        contentClassifier: c,
      });
      expect(r.countsTowardCoverage).toBe(false);
      expect(r.contentClassifier).toBe(c);
    }
  });

  it("rejects unknown mood values (returns null but does not crash)", () => {
    const r = normalizeListeningSummary({
      reaganVoicePresent: true,
      moodEstimate: "grumpypants",
      contentClassifier: "lesson",
    });
    expect(r.moodEstimate).toBeNull();
  });

  it("filters out unknown behavior tags and dedupes", () => {
    const r = normalizeListeningSummary({
      behaviorTags: ["focused", "focused", "garbage", "asking-questions"],
    });
    expect(r.behaviorTags).toEqual(["focused", "asking-questions"]);
  });

  it("caps behavior tags at 4 (defense against runaway model output)", () => {
    const r = normalizeListeningSummary({
      behaviorTags: [
        "focused",
        "asking-questions",
        "helping-out",
        "off-topic",
        "distracted",
        "refusing",
      ],
    });
    expect(r.behaviorTags).toHaveLength(4);
  });

  it("unknown classifier returns null and never counts toward coverage", () => {
    const r = normalizeListeningSummary({
      reaganVoicePresent: true,
      contentClassifier: "rocket-science",
    });
    expect(r.contentClassifier).toBeNull();
    expect(r.countsTowardCoverage).toBe(false);
  });

  it("non-array behaviorTags input returns []", () => {
    const r = normalizeListeningSummary({
      behaviorTags: "focused" as any,
    });
    expect(r.behaviorTags).toEqual([]);
  });

  it("MOOD_VALUES and BEHAVIOR_VALUES match the slice 4.5 contract list", () => {
    expect([...MOOD_VALUES]).toEqual([
      "calm",
      "engaged",
      "frustrated",
      "tired",
      "silly",
      "upset",
      "excited",
    ]);
    expect([...BEHAVIOR_VALUES]).toEqual([
      "focused",
      "distracted",
      "talking-back",
      "asking-questions",
      "off-topic",
      "helping-out",
      "refusing",
    ]);
  });

  it("default-empty input returns a safe payload", () => {
    const r = normalizeListeningSummary({});
    expect(r).toEqual({
      reaganVoicePresent: false,
      moodEstimate: null,
      behaviorTags: [],
      contentClassifier: null,
      countsTowardCoverage: false,
    });
  });
});
