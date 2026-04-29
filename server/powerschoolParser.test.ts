import { describe, it, expect } from "vitest";
import { parsePowerSchoolPaste } from "./_lib/powerschoolParser";

describe("powerschool parser", () => {
  it("parses a tab-separated grades table paste", () => {
    const raw = [
      "Course\tTeacher\tQ1\tQ2\tQ3\tQ4\tFinal",
      "Math 5\tPeterson\tA\t88%\tB+\tA-\t91%",
      "ELA 5\tSmith\tB\t82%\tB-\tB\t85%",
    ].join("\n");
    const r = parsePowerSchoolPaste(raw);
    expect(r.kind).toBe("grades");
    expect(r.grades.length).toBeGreaterThan(0);
    const math = r.grades.find((g) => g.course === "Math 5" && g.letter === "A");
    expect(math).toBeTruthy();
    expect(math?.term).toBe("Q1");
  });

  it("parses an assignment list paste with pipe separators", () => {
    const raw = [
      "Math 5 — Mrs. Peterson",
      "Due Date | Category | Assignment | Score",
      "4/12 | Homework | Fractions practice | 18/20",
      "4/15 | Quiz | Decimals quiz | 85%",
    ].join("\n");
    const r = parsePowerSchoolPaste(raw);
    expect(["assignments", "mixed"]).toContain(r.kind);
    expect(r.assignments.length).toBe(2);
    expect(r.assignments[0].course).toBe("Math 5 — Mrs. Peterson");
    expect(r.assignments[0].dueDate).toBe("4/12");
    expect(r.assignments[1].score).toBe("85%");
  });

  it("returns empty result with note for gibberish", () => {
    const r = parsePowerSchoolPaste("hello world, nothing to see here");
    expect(r.grades.length).toBe(0);
    expect(r.assignments.length).toBe(0);
    expect(r.notes.join(" ").toLowerCase()).toContain("recognize");
  });

  it("tolerates an empty paste", () => {
    const r = parsePowerSchoolPaste("   \n  \n");
    expect(r.kind).toBe("unknown");
  });
});
