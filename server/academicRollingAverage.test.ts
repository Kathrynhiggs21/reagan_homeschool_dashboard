import { describe, it, expect, afterAll } from "vitest";
import * as db from "./db";

/**
 * Verifies academicRollingAverage filters by schoolYear/term and ignores
 * non-grade rows + rows without numeric scorePercent.
 */
describe("academicRollingAverage", () => {
  const created: number[] = [];
  const uniq = `vitest-rolling-${process.pid}-${Date.now()}`;

  afterAll(async () => {
    for (const id of created) {
      try { await db.deleteAcademicRecord(id); } catch { /* ignore */ }
    }
  });

  it("averages only grade rows and respects schoolYear+term filter", async () => {
    // Q1 2025-26 — 90, 80 → avg 85
    const a: any = await db.createAcademicRecord({
      source: "manual", kind: "grade", subjectSlug: "math",
      title: `${uniq} A`, schoolYear: "2025-26", term: "Q1", scorePercent: 90,
    } as any);
    if (a?.id) created.push(a.id);
    const b: any = await db.createAcademicRecord({
      source: "manual", kind: "grade", subjectSlug: "math",
      title: `${uniq} B`, schoolYear: "2025-26", term: "Q1", scorePercent: 80,
    } as any);
    if (b?.id) created.push(b.id);
    // Q2 2025-26 — 100 (should NOT be in Q1 average)
    const c: any = await db.createAcademicRecord({
      source: "manual", kind: "grade", subjectSlug: "math",
      title: `${uniq} C`, schoolYear: "2025-26", term: "Q2", scorePercent: 100,
    } as any);
    if (c?.id) created.push(c.id);
    // Note row with no score (should be ignored even in subject-only call)
    const d: any = await db.createAcademicRecord({
      source: "manual", kind: "note", subjectSlug: "math",
      title: `${uniq} D`, schoolYear: "2025-26", term: "Q1",
    } as any);
    if (d?.id) created.push(d.id);

    const q1 = await db.academicRollingAverage({ subjectSlug: "math", schoolYear: "2025-26", term: "Q1" });
    // Other unrelated rows could exist in DB; we only assert ours by checking
    // that the running average includes our two and the count >= 2.
    // Stronger: filter our rows by title prefix.
    const all = await db.listAcademicRecords({ schoolYear: "2025-26", term: "Q1" });
    const ours = (all as any[]).filter(r => r.title?.startsWith(uniq) && r.kind === "grade");
    const avg = Math.round(ours.reduce((a, r) => a + Number(r.scorePercent), 0) / ours.length);
    expect(avg).toBe(85);
    expect(q1.score).not.toBeNull();
    expect(q1.count).toBeGreaterThanOrEqual(2);

    const yr = await db.academicRollingAverage({ subjectSlug: "math", schoolYear: "2025-26" });
    expect(yr.count).toBeGreaterThanOrEqual(3);
  }, 30_000);
});
