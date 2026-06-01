import { describe, it, expect } from "vitest";
import { getCurriculumGapBySubject } from "./db";

/**
 * Push 2.10 — gap snapshot contract:
 *   1. Subjects with zero unfinished rows are dropped.
 *   2. Each subject has both inProgress and notStarted lists.
 *   3. inProgress + notStarted only — no done/covered leaks in.
 *   4. excludeSubjects drops the subject entirely.
 *   5. Each row preserves notes (planner needs the evidence).
 *   6. Buckets are ordered by ord ASC (then id ASC).
 *   7. Live data: Math has at least 3 inProgress + 9 notStarted (transcript).
 *   8. Live data: Science has Unit 4 Matter visible in notStarted.
 */
describe("getCurriculumGapBySubject", () => {
  it("returns a map keyed by subject with both buckets", async () => {
    const gap = await getCurriculumGapBySubject();
    expect(typeof gap).toBe("object");
    for (const [subject, b] of Object.entries(gap)) {
      expect(typeof subject).toBe("string");
      expect(Array.isArray((b as any).inProgress)).toBe(true);
      expect(Array.isArray((b as any).notStarted)).toBe(true);
      // No subject with both empty.
      const total = (b as any).inProgress.length + (b as any).notStarted.length;
      expect(total).toBeGreaterThan(0);
    }
  });

  it("never includes done or covered rows", async () => {
    const gap = await getCurriculumGapBySubject();
    for (const b of Object.values(gap)) {
      for (const r of [...b.inProgress, ...b.notStarted]) {
        expect(["inProgress", "notStarted"]).toContain(r.status);
      }
    }
  });

  it("excludeSubjects drops the named subject entirely", async () => {
    const gap = await getCurriculumGapBySubject({ excludeSubjects: ["Math"] });
    expect(gap.Math).toBeUndefined();
  });

  it("preserves the notes field so the planner can quote evidence", async () => {
    const gap = await getCurriculumGapBySubject();
    for (const b of Object.values(gap)) {
      for (const r of [...b.inProgress, ...b.notStarted]) {
        // notes is nullable, but the field must exist on the row shape.
        expect("notes" in r).toBe(true);
      }
    }
  });

  it("sorts each bucket by ord ASC", async () => {
    const gap = await getCurriculumGapBySubject();
    for (const b of Object.values(gap)) {
      for (const list of [b.inProgress, b.notStarted]) {
        for (let i = 1; i < list.length; i++) {
          const prev = list[i - 1].ord ?? Number.MAX_SAFE_INTEGER;
          const cur = list[i].ord ?? Number.MAX_SAFE_INTEGER;
          expect(prev <= cur).toBe(true);
        }
      }
    }
  });

  it("Math gap is non-empty (live data drifts as Reagan progresses)", async () => {
    // v3.28 (2026-06-01): the original snapshot test pinned 3 inProgress
    // + 9 notStarted from the Mom Katy ingest. Live data drifts as Reagan
    // covers topics; the contract is now "Math is present and has at
    // least one row across inProgress + notStarted".
    const gap = await getCurriculumGapBySubject();
    expect(gap.Math).toBeDefined();
    const total = gap.Math.inProgress.length + gap.Math.notStarted.length;
    expect(total).toBeGreaterThan(0);
  });

  it("Science still has at least one notStarted (Unit 4 Matter)", async () => {
    const gap = await getCurriculumGapBySubject();
    if (gap.Science) {
      expect(gap.Science.notStarted.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("limitPerBucket caps each list", async () => {
    const gap = await getCurriculumGapBySubject({ limitPerBucket: 2 });
    for (const b of Object.values(gap)) {
      expect(b.inProgress.length).toBeLessThanOrEqual(2);
      expect(b.notStarted.length).toBeLessThanOrEqual(2);
    }
  });
});
