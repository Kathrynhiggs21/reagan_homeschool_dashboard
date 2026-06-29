import { describe, it, expect } from "vitest";
import {
  computeSubjectLevel,
  buildPlacementLevelReport,
  subjectName,
  type ProbeResponse,
} from "./_lib/placementLevel";

/** Helper to build a probe response quickly. */
function p(
  gradeLevel: string,
  isCorrect: boolean | null,
  feltIt: ProbeResponse["feltIt"] = "ok",
  strand: string | null = "Number Sense",
  subjectSlug = "math",
): ProbeResponse {
  return { subjectSlug, strand, gradeLevel, isCorrect, feltIt };
}

describe("placementLevel — computeSubjectLevel", () => {
  it("returns not-assessed (null grade) when there are no responses", () => {
    const r = computeSubjectLevel("math", [], 12);
    expect(r.estimatedGrade).toBeNull();
    expect(r.estimatedGradePrecise).toBeNull();
    expect(r.label).toBe("Not assessed yet");
    expect(r.confidence).toBe(0);
    expect(r.summary).toMatch(/hasn't been checked yet/i);
    expect(r.nextStep).toMatch(/Skill Check-up/i);
  });

  it("returns not-assessed when responses exist but none are gradeable", () => {
    // all skipped / ungraded
    const r = computeSubjectLevel("math", [p("5", null, "skip"), p("5", null, "skip")], 12);
    expect(r.estimatedGrade).toBeNull();
    expect(r.answered).toBeGreaterThan(0); // they were answered (as skips), just not gradeable
  });

  it("places ON GRADE (5) when on-grade probes pass but stretch does not", () => {
    const responses = [
      p("4", true, "easy"),
      p("4", true, "easy"),
      p("5", true, "ok"),
      p("5", true, "ok"),
      p("5", true, "ok"),
      p("5", false, "ok"),
      p("6", false, "hard"),
      p("6", false, "hard"),
    ];
    const r = computeSubjectLevel("math", responses, 12);
    expect(r.estimatedGrade).toBe(5);
    expect(r.label).toMatch(/On grade/i);
  });

  it("places ABOVE GRADE (6) when stretch probes are aced", () => {
    const responses = [
      p("4", true, "easy"),
      p("5", true, "easy"),
      p("5", true, "easy"),
      p("5", true, "ok"),
      p("6", true, "ok"),
      p("6", true, "ok"),
      p("6", true, "easy"),
    ];
    const r = computeSubjectLevel("math", responses, 12);
    expect(r.estimatedGrade).toBe(6);
    expect(r.estimatedGradePrecise).toBe(6);
    expect(r.label).toMatch(/above grade/i);
    expect(r.nextStep).toMatch(/stretch|enrichment|challenge/i);
  });

  it("places A YEAR BELOW (4) when on-grade fails but below-grade passes", () => {
    const responses = [
      p("4", true, "ok"),
      p("4", true, "ok"),
      p("4", true, "ok"),
      p("5", false, "hard"),
      p("5", false, "hard"),
      p("6", false, "hard"),
    ];
    const r = computeSubjectLevel("math", responses, 12);
    expect(r.estimatedGrade).toBe(4);
    expect((r.estimatedGradePrecise ?? 9)).toBeLessThanOrEqual(4.5);
    expect(r.label).toMatch(/4th/i);
  });

  it("places FOUNDATIONAL (3) when both below- and on-grade fail badly", () => {
    const responses = [
      p("4", false, "hard"),
      p("4", false, "hard"),
      p("4", false, "hard"),
      p("5", false, "hard"),
      p("6", false, "hard"),
    ];
    const r = computeSubjectLevel("math", responses, 12);
    expect(r.estimatedGrade).toBeLessThanOrEqual(4);
    expect((r.estimatedGradePrecise ?? 9)).toBeLessThanOrEqual(4);
    expect(r.label).toMatch(/Foundational/i);
  });

  it("never fabricates a grade — a hard-felt all-wrong on-grade set is not 'secure'", () => {
    const responses = [p("5", false, "hard"), p("5", false, "hard")];
    const r = computeSubjectLevel("math", responses, 12);
    expect(r.security).not.toBe("secure");
  });

  it("computes band accuracy from GRADED probes only", () => {
    const responses = [
      p("5", true, "ok"),
      p("5", false, "ok"),
      p("5", null, "skip"), // ungraded — excluded from accuracy denominator
    ];
    const r = computeSubjectLevel("math", responses, 12);
    const band5 = r.bands.find((b) => b.grade === "5")!;
    expect(band5.graded).toBe(2);
    expect(band5.accuracy).toBe(50);
  });

  it("rolls up per-strand levels and surfaces the weakest strand in nextStep", () => {
    const responses = [
      // Strong strand: Number Sense at/above grade
      p("5", true, "ok", "Number Sense"),
      p("5", true, "ok", "Number Sense"),
      p("5", true, "ok", "Number Sense"),
      p("6", true, "ok", "Number Sense"),
      // Weak strand: Fractions below grade
      p("4", true, "ok", "Fractions"),
      p("5", false, "hard", "Fractions"),
      p("5", false, "hard", "Fractions"),
    ];
    const r = computeSubjectLevel("math", responses, 12);
    expect(r.strands.length).toBeGreaterThanOrEqual(2);
    const fractions = r.strands.find((s) => s.strand === "Fractions");
    const numberSense = r.strands.find((s) => s.strand === "Number Sense");
    expect(fractions?.estimatedGrade ?? 9).toBeLessThan(numberSense?.estimatedGrade ?? 0);
  });

  it("confidence rises with more answered + gradeable probes", () => {
    const few = computeSubjectLevel("math", [p("5", true, "ok")], 12);
    const many = computeSubjectLevel(
      "math",
      Array.from({ length: 8 }, () => p("5", true, "easy")),
      12,
    );
    expect(many.confidence).toBeGreaterThan(few.confidence);
    expect(many.confidence).toBeLessThanOrEqual(95);
  });
});

describe("placementLevel — buildPlacementLevelReport", () => {
  it("returns an unassessed report with a clear narrative when empty", () => {
    const report = buildPlacementLevelReport([], { math: 12, ela: 12 });
    expect(report.assessedCount).toBe(0);
    expect(report.subjectCount).toBe(2);
    expect(report.narrative).toMatch(/hasn't completed any diagnostic/i);
    // every subject is present but unassessed
    expect(report.subjects.every((s) => s.estimatedGrade === null)).toBe(true);
  });

  it("includes subjects from responses even if not in probeTotals", () => {
    const responses = [p("5", true, "ok", "Number Sense", "science")];
    const report = buildPlacementLevelReport(responses, { math: 12 });
    expect(report.subjects.map((s) => s.subjectSlug).sort()).toEqual(["math", "science"]);
  });

  it("builds a per-subject narrative for assessed subjects with confidence", () => {
    const responses = [
      p("5", true, "ok", "Number Sense", "math"),
      p("5", true, "ok", "Number Sense", "math"),
      p("5", true, "ok", "Number Sense", "math"),
    ];
    const report = buildPlacementLevelReport(responses, { math: 12 });
    expect(report.assessedCount).toBe(1);
    expect(report.narrative.toLowerCase()).toContain("math");
    expect(report.narrative).toMatch(/confidence \d+%/i);
  });
});

describe("placementLevel — subjectName", () => {
  it("maps known slugs and falls back to the slug itself", () => {
    expect(subjectName("math")).toBe("Math");
    expect(subjectName("ela")).toBe("Reading & Writing");
    expect(subjectName("ss")).toBe("Social Studies");
    expect(subjectName("unknown_subject")).toBe("unknown_subject");
  });
});
