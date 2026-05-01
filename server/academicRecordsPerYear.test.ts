import { describe, it, expect, afterAll } from "vitest";
import * as db from "./db";

/**
 * End-to-end check that academicRecords now persists grade/schoolYear/term/teacher/courseName
 * and that listAcademicRecords filters by them.
 */
describe("academicRecords per-year fields", () => {
  const created: number[] = [];

  afterAll(async () => {
    for (const id of created) {
      try { await db.deleteAcademicRecord(id); } catch { /* ignore */ }
    }
  });

  it("round-trips per-year fields and filters by schoolYear+term", async () => {
    const uniq = `vitest-per-year-${process.pid}-${Date.now()}`;
    const a: any = await db.createAcademicRecord({
      source: "manual",
      kind: "grade",
      subjectSlug: "math",
      title: `${uniq} Q1`,
      grade: "5",
      schoolYear: "2025-26",
      term: "Q1",
      teacher: "Mr. Test",
      courseName: "Math 5",
      scoreText: "92%",
      scorePercent: 92,
    } as any);
    if (a?.id) created.push(a.id);
    const b: any = await db.createAcademicRecord({
      source: "manual",
      kind: "grade",
      subjectSlug: "math",
      title: `${uniq} Q2`,
      grade: "5",
      schoolYear: "2025-26",
      term: "Q2",
      teacher: "Mr. Test",
      courseName: "Math 5",
      scoreText: "88%",
      scorePercent: 88,
    } as any);
    if (b?.id) created.push(b.id);

    expect(a.grade).toBe("5");
    expect(a.schoolYear).toBe("2025-26");
    expect(a.term).toBe("Q1");
    expect(a.teacher).toBe("Mr. Test");
    expect(a.courseName).toBe("Math 5");

    const q1 = await db.listAcademicRecords({ schoolYear: "2025-26", term: "Q1", limit: 50 });
    const titles = (q1 as any[]).map(r => r.title);
    expect(titles.some(t => t === `${uniq} Q1`)).toBe(true);
    expect(titles.some(t => t === `${uniq} Q2`)).toBe(false);

    const yr = await db.listAcademicRecords({ schoolYear: "2025-26", limit: 50 });
    const titles2 = (yr as any[]).map(r => r.title);
    expect(titles2.some(t => t === `${uniq} Q1`)).toBe(true);
    expect(titles2.some(t => t === `${uniq} Q2`)).toBe(true);
  }, 30_000);
});
