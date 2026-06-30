import { describe, it, expect } from "vitest";
import {
  ixlScoreToGrade,
  parseGradeEquivalent,
  strandKeyFromLabel,
  gradeLabel,
  rowGrade,
  buildIxlDiagnosticReport,
  ixlSubjectName,
  IXL_SUBJECTS,
  IXL_STRANDS,
  IXL_DIAGNOSTIC_URL,
  type IxlLevelRow,
} from "./_lib/ixlDiagnostic";

describe("ixlScoreToGrade", () => {
  it("maps IXL anchor levels to grade equivalents (grade = level/100 - 1)", () => {
    expect(ixlScoreToGrade(100)).toBe(0); // K
    expect(ixlScoreToGrade(200)).toBe(1);
    expect(ixlScoreToGrade(500)).toBe(4);
    expect(ixlScoreToGrade(600)).toBe(5);
    expect(ixlScoreToGrade(700)).toBe(6);
  });

  it("rounds to one decimal", () => {
    expect(ixlScoreToGrade(560)).toBe(4.6);
    expect(ixlScoreToGrade(635)).toBe(5.4); // 5.35 -> 5.4
  });

  it("clamps to a sane K-12 band", () => {
    expect(ixlScoreToGrade(50)).toBe(0); // below K clamps to 0
    expect(ixlScoreToGrade(1300)).toBe(null); // out of accepted input range
  });

  it("returns null for nonsense / missing input", () => {
    expect(ixlScoreToGrade(null)).toBe(null);
    expect(ixlScoreToGrade(undefined)).toBe(null);
    expect(ixlScoreToGrade(NaN)).toBe(null);
    expect(ixlScoreToGrade(-10)).toBe(null);
  });
});

describe("parseGradeEquivalent", () => {
  it("parses numeric grades", () => {
    expect(parseGradeEquivalent("4.5")).toBe(4.5);
    expect(parseGradeEquivalent("5")).toBe(5);
    expect(parseGradeEquivalent("3.0")).toBe(3);
  });
  it("parses K / kindergarten", () => {
    expect(parseGradeEquivalent("K")).toBe(0);
    expect(parseGradeEquivalent("kindergarten")).toBe(0);
  });
  it("strips junk and clamps", () => {
    expect(parseGradeEquivalent("grade 4.2")).toBe(4.2);
    expect(parseGradeEquivalent("15")).toBe(12);
  });
  it("returns null for empty / missing", () => {
    expect(parseGradeEquivalent("")).toBe(null);
    expect(parseGradeEquivalent(null)).toBe(null);
    expect(parseGradeEquivalent(undefined)).toBe(null);
  });
});

describe("strandKeyFromLabel", () => {
  it("slugifies labels into stable upsert keys", () => {
    expect(strandKeyFromLabel("Numbers & Operations")).toBe("numbers-and-operations");
    expect(strandKeyFromLabel("  Fractions  ")).toBe("fractions");
    expect(strandKeyFromLabel("Data, Statistics & Probability")).toBe(
      "data-statistics-and-probability",
    );
  });
  it("never returns empty", () => {
    expect(strandKeyFromLabel("")).toBe("strand");
    expect(strandKeyFromLabel("***")).toBe("strand");
  });
});

describe("gradeLabel (calm, non-testing language)", () => {
  it("never uses test/score/fail vocabulary", () => {
    const labels = [-3, -1.5, -0.5, 0, 0.5, 2].map((d) => gradeLabel(5 + d, 5));
    for (const l of labels) {
      expect(l.toLowerCase()).not.toMatch(/test|score|fail|wrong/);
    }
  });
  it("describes relative position to grade 5", () => {
    expect(gradeLabel(6.5, 5)).toMatch(/above grade/i);
    expect(gradeLabel(5, 5)).toMatch(/on grade/i);
    expect(gradeLabel(3.5, 5)).toMatch(/below|foundations/i);
  });
  it("handles null", () => {
    expect(gradeLabel(null, 5)).toMatch(/not recorded/i);
  });
});

describe("rowGrade", () => {
  const base: IxlLevelRow = {
    subjectSlug: "math",
    strandKey: "overall",
    strandLabel: "Overall",
    ixlScore: null,
    gradeEquivalent: null,
    measuredAt: new Date(),
  };
  it("prefers explicit grade equivalent over the score mapping", () => {
    expect(rowGrade({ ...base, ixlScore: 600, gradeEquivalent: "3.0" })).toBe(3);
  });
  it("falls back to score mapping when no grade equivalent", () => {
    expect(rowGrade({ ...base, ixlScore: 600 })).toBe(5);
  });
  it("null when neither present", () => {
    expect(rowGrade(base)).toBe(null);
  });
});

describe("buildIxlDiagnosticReport", () => {
  it("never fabricates: empty rows => recordedCount 0 + 'not recorded' narrative, both subjects present", () => {
    const r = buildIxlDiagnosticReport([], 5);
    expect(r.recordedCount).toBe(0);
    expect(r.narrative.toLowerCase()).toMatch(/no ixl diagnostic levels/);
    expect(r.subjects.map((s) => s.subjectSlug).sort()).toEqual(["ela", "math"]);
    for (const s of r.subjects) {
      expect(s.overallGrade).toBe(null);
      expect(s.summary.toLowerCase()).toMatch(/no ixl diagnostic level recorded yet/);
    }
  });

  it("builds an overall grade + calm label from a recorded overall level", () => {
    const rows: IxlLevelRow[] = [
      {
        subjectSlug: "math",
        strandKey: "overall",
        strandLabel: "Overall",
        ixlScore: 560,
        gradeEquivalent: null,
        measuredAt: new Date("2026-06-30T12:00:00Z"),
      },
    ];
    const r = buildIxlDiagnosticReport(rows, 5);
    expect(r.recordedCount).toBe(1);
    const math = r.subjects.find((s) => s.subjectSlug === "math")!;
    expect(math.overallGrade).toBe(4.6);
    expect(math.overallScore).toBe(560);
    expect(math.measuredAtIso).toContain("2026-06-30");
    expect(r.narrative).toMatch(/Math/);
  });

  it("orders strands weakest-first and points the next step at the lowest strand", () => {
    const rows: IxlLevelRow[] = [
      { subjectSlug: "math", strandKey: "overall", strandLabel: "Overall", ixlScore: 560, gradeEquivalent: null, measuredAt: new Date() },
      { subjectSlug: "math", strandKey: "geometry", strandLabel: "Geometry", ixlScore: 600, gradeEquivalent: null, measuredAt: new Date() },
      { subjectSlug: "math", strandKey: "fractions", strandLabel: "Fractions", ixlScore: 420, gradeEquivalent: null, measuredAt: new Date() },
    ];
    const r = buildIxlDiagnosticReport(rows, 5);
    const math = r.subjects.find((s) => s.subjectSlug === "math")!;
    expect(math.strands[0].strandLabel).toBe("Fractions"); // weakest first
    expect(math.nextStep).toMatch(/Fractions/);
  });

  it("marks a relative strength next step when overall is at/above grade", () => {
    const rows: IxlLevelRow[] = [
      { subjectSlug: "ela", strandKey: "overall", strandLabel: "Overall", ixlScore: 650, gradeEquivalent: null, measuredAt: new Date() },
    ];
    const r = buildIxlDiagnosticReport(rows, 5);
    const ela = r.subjects.find((s) => s.subjectSlug === "ela")!;
    expect(ela.overallGrade).toBe(5.5);
    expect(ela.nextStep.toLowerCase()).toMatch(/strength|challenge|grade-level/);
  });
});

describe("constants", () => {
  it("exposes both IXL subjects with strand groups", () => {
    expect(IXL_SUBJECTS).toEqual(["math", "ela"]);
    expect(IXL_STRANDS.math[0].key).toBe("overall");
    expect(IXL_STRANDS.ela[0].key).toBe("overall");
    expect(ixlSubjectName("ela")).toBe("Language Arts");
  });
  it("uses the verified live diagnostic URL", () => {
    expect(IXL_DIAGNOSTIC_URL).toBe("https://www.ixl.com/diagnostic");
  });
});
