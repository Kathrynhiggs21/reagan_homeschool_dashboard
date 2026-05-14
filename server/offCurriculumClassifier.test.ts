/**
 * Push 157 (2026-05-14) — vitest contract for off-curriculum-topic classifier.
 */
import { describe, it, expect } from "vitest";
import {
  classifyOffCurriculum,
  type CurriculumTopicCandidate,
} from "./_lib/offCurriculumClassifier";

const CATALOG: CurriculumTopicCandidate[] = [
  {
    id: "sci_volcanoes",
    subject: "science",
    label: "Earth science — Volcanoes",
    keywords: ["volcano", "lava", "magma", "eruption"],
  },
  {
    id: "sci_food_web",
    subject: "science",
    label: "Life science — Food web",
    keywords: ["food chain", "food web", "predator", "prey", "producer", "consumer"],
  },
  {
    id: "math_fractions",
    subject: "math",
    label: "Math — Fractions",
    keywords: ["fraction", "numerator", "denominator", "equivalent fractions"],
  },
];

describe("Push 157 — classifyOffCurriculum", () => {
  it("matches a clear catalog topic with high confidence", () => {
    const c = classifyOffCurriculum(
      "We watched a video about volcanoes erupting under the ocean.",
      CATALOG,
    );
    expect(c.decision).toBe("matched_existing");
    expect(c.matchedTopicId).toBe("sci_volcanoes");
    expect(c.confidence).toBeGreaterThanOrEqual(0.6);
    expect(c.adultCopy).toContain("Volcanoes");
  });

  it("matches a multi-word keyword like 'food web'", () => {
    const c = classifyOffCurriculum(
      "We talked about the food web and how owls are predators.",
      CATALOG,
    );
    expect(c.decision).toBe("matched_existing");
    expect(c.matchedTopicId).toBe("sci_food_web");
  });

  it("proposes a new topic when chunk is educational but not in catalog", () => {
    const c = classifyOffCurriculum(
      "Today we talked about how octopuses have three hearts.",
      CATALOG,
    );
    expect(c.decision).toBe("new_topic_candidate");
    expect(c.proposedSubject).toBe("science");
    expect(c.proposedLabel).toMatch(/Science/);
    expect(c.adultCopy).toContain("Tap to add");
  });

  it("classifies pure chatter as no_topic", () => {
    const c = classifyOffCurriculum("hi", CATALOG);
    expect(c.decision).toBe("no_topic");
    expect(c.confidence).toBe(0);
  });

  it("classifies 'I love you Mom' as no_topic", () => {
    const c = classifyOffCurriculum("love you Mom", CATALOG);
    expect(c.decision).toBe("no_topic");
  });

  it("preserves rawChunk verbatim (trimmed)", () => {
    const c = classifyOffCurriculum("   We learned about fractions.   ", CATALOG);
    expect(c.rawChunk).toBe("We learned about fractions.");
    expect(c.decision).toBe("matched_existing");
    expect(c.matchedTopicId).toBe("math_fractions");
  });

  it("uses a Mom-readable adultCopy with no jargon", () => {
    const c = classifyOffCurriculum(
      "We watched volcanoes erupting on YouTube.",
      CATALOG,
    );
    expect(c.adultCopy.toLowerCase()).not.toMatch(/\b(json|catalog|enum|mutation|payload)\b/);
  });

  it("threshold override raises the bar for a match", () => {
    const c = classifyOffCurriculum(
      "We had a quick chat about lava.",
      CATALOG,
      { matchThreshold: 0.95 },
    );
    expect(c.decision).not.toBe("matched_existing");
  });

  it("rejects empty input", () => {
    expect(() => classifyOffCurriculum("   ", CATALOG)).toThrow(/empty/);
  });

  it("non-string input throws", () => {
    expect(() => classifyOffCurriculum(undefined as never, CATALOG)).toThrow(/string/);
  });

  it("falls through to no_topic when chunk has no subject hint", () => {
    const c = classifyOffCurriculum(
      "We sat outside and looked at clouds.",
      CATALOG,
    );
    // 'cloud' is in the science heuristic regex
    expect(c.decision).toBe("new_topic_candidate");
    expect(c.proposedSubject).toBe("science");
  });

  it("matches social_studies when the term is presidential", () => {
    const c = classifyOffCurriculum(
      "We talked about the constitution amendments.",
      CATALOG,
    );
    expect(c.decision).toBe("new_topic_candidate");
    expect(c.proposedSubject).toBe("social_studies");
    expect(c.proposedLabel).toMatch(/Social studies/);
  });

  it("matches ela when the term is grammar-ish", () => {
    const c = classifyOffCurriculum(
      "We learned what a metaphor is.",
      CATALOG,
    );
    expect(c.decision).toBe("new_topic_candidate");
    expect(c.proposedSubject).toBe("ela");
  });
});
