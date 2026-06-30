import { describe, it, expect } from "vitest";
import { isAcademicSubject } from "@shared/academicSubjects";

describe("academic subject classifier (drives reliable-PDF-first vs external-link-first)", () => {
  const ACADEMIC = [
    "math", "arithmetic",
    "ela", "english", "language_arts",
    "reading", "writing",
    "science",
    "ss", "social_studies", "history",
    "spelling",
  ];
  const ACTIVITY = ["art", "music", "outdoors", "nature", "pe", "snack", "break", "wonder"];

  for (const s of ACADEMIC) {
    it(`treats "${s}" as academic (hosted PDF is the primary action)`, () => {
      expect(isAcademicSubject(s)).toBe(true);
    });
  }

  for (const s of ACTIVITY) {
    it(`treats "${s}" as an activity (external link stays primary)`, () => {
      expect(isAcademicSubject(s)).toBe(false);
    });
  }

  it("is case-insensitive and trims whitespace", () => {
    expect(isAcademicSubject("  MATH ")).toBe(true);
    expect(isAcademicSubject("Reading")).toBe(true);
  });

  it("is safe for null/undefined/empty (never academic)", () => {
    expect(isAcademicSubject(null)).toBe(false);
    expect(isAcademicSubject(undefined)).toBe(false);
    expect(isAcademicSubject("")).toBe(false);
  });
});
