import { describe, it, expect } from "vitest";
import {
  buildDeterministicWorksheet,
  isNonAcademicBlock,
  type WorksheetSeed,
} from "./_lib/worksheetGenerator";
import { isUsableWorksheet, countAnswerable } from "@shared/worksheetTypes";

describe("isNonAcademicBlock", () => {
  it("treats lunch/break/recess/free play as non-academic", () => {
    for (const t of ["Lunch", "Snack break", "Recess", "Free Play", "Brain Break", "Ali visit"]) {
      expect(isNonAcademicBlock({ title: t })).toBe(true);
    }
  });
  it("treats appointment blockType as non-academic", () => {
    expect(isNonAcademicBlock({ title: "Anything", blockType: "appointment" })).toBe(true);
  });
  it("treats real lessons as academic", () => {
    for (const t of ["Intro to Measurement Conversions", "Haiku writing", "Reading: Tuck Everlasting", "Science: Volume"]) {
      expect(isNonAcademicBlock({ title: t })).toBe(false);
    }
  });
});

describe("buildDeterministicWorksheet", () => {
  const cases: Array<{ name: string; seed: WorksheetSeed }> = [
    { name: "math conversions", seed: { blockTitle: "Intro to Measurement Conversions", subjectSlug: "math" } },
    { name: "math metric", seed: { blockTitle: "Metric Units Intro", subjectSlug: "math", topicHint: "metric base-10 ladder" } },
    { name: "math volume", seed: { blockTitle: "Volume Intro", subjectSlug: "math", topicHint: "volume unit cubes" } },
    { name: "writing haiku", seed: { blockTitle: "Poetry: Haiku", subjectSlug: "ela", topicHint: "haiku poem 5-7-5" } },
    { name: "reading", seed: { blockTitle: "Reading: Tuck Everlasting", subjectSlug: "reading", bookRef: "Tuck Everlasting pg 24-28" } },
    { name: "ela language", seed: { blockTitle: "180 Days of Language", subjectSlug: "ela" } },
    { name: "science", seed: { blockTitle: "Science: Water Cycle", subjectSlug: "science" } },
    { name: "generic", seed: { blockTitle: "Something New", subjectSlug: null } },
  ];

  for (const c of cases) {
    it(`produces a usable, non-empty worksheet for ${c.name}`, () => {
      const w = buildDeterministicWorksheet(c.seed);
      expect(isUsableWorksheet(w)).toBe(true);
      expect(w.title).toBe(c.seed.blockTitle);
      expect(countAnswerable(w)).toBeGreaterThan(0);
      // every answerable item has a stable id + prompt
      for (const sec of w.sections) {
        for (const it of sec.items) {
          expect(it.id).toBeTruthy();
          expect(it.prompt).toBeTruthy();
          if (it.kind === "mc") expect(Array.isArray(it.choices) && it.choices.length >= 2).toBe(true);
        }
      }
    });
  }

  it("carries through bookRef when provided", () => {
    const w = buildDeterministicWorksheet({ blockTitle: "Reading", subjectSlug: "reading", bookRef: "Tuck Everlasting pg 24-28" });
    expect(w.bookRef).toBe("Tuck Everlasting pg 24-28");
  });
});
