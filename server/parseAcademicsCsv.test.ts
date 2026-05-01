/**
 * parseAcademicsCsv handles common header synonyms + quoted commas.
 */
import { describe, it, expect } from "vitest";
import { parseAcademicsCsv, parseCsvLine } from "../client/src/lib/parseAcademicsCsv";

describe("parseAcademicsCsv", () => {
  it("parses quoted commas and escaped quotes", () => {
    const cells = parseCsvLine(`"Math, advanced","Q1","She said ""good"""`);
    expect(cells).toEqual(["Math, advanced", "Q1", 'She said "good"']);
  });

  it("normalises common header synonyms", () => {
    const csv = [
      "Assignment,Class,Quarter,Year,Letter,Percentage,Notes",
      "Quiz 3,Math 4,Q2,2024-25,A,93,She did great",
    ].join("\n");
    const rows = parseAcademicsCsv(csv);
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(r.title).toBe("Quiz 3");
    expect(r.courseName).toBe("Math 4");
    expect(r.term).toBe("Q2");
    expect(r.schoolYear).toBe("2024-25");
    expect(r.scoreText).toBe("A");
    expect(r.scorePercent).toBe(93);
    expect(r.summary).toBe("She did great");
    expect(r.source).toBe("manual");
    expect(r.kind).toBe("grade");
  });

  it("skips rows with no title", () => {
    const csv = "title,score\n,A\nQuiz 1,B";
    const rows = parseAcademicsCsv(csv);
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe("Quiz 1");
  });

  it("returns empty for header-only input", () => {
    expect(parseAcademicsCsv("title,score").length).toBe(0);
    expect(parseAcademicsCsv("").length).toBe(0);
  });
});
