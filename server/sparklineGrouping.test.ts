import { describe, it, expect } from "vitest";
import { groupSubmissionsForSparklines } from "../client/src/lib/sparklineGrouping";

describe("groupSubmissionsForSparklines", () => {
  const now = new Date("2026-05-01T12:00:00Z").getTime();

  it("groups by subjectSlug + filters to last 30 days + computes avg", () => {
    const subs = [
      { submittedAt: new Date(now - 1 * 86400000), subjectSlug: "math", rubricScore: 80 },
      { submittedAt: new Date(now - 2 * 86400000), subjectSlug: "math", rubricScore: 100 },
      { submittedAt: new Date(now - 5 * 86400000), subjectSlug: "ela", rubricScore: 70 },
      { submittedAt: new Date(now - 60 * 86400000), subjectSlug: "math", rubricScore: 50 }, // outside 30d
      { submittedAt: new Date(now - 1 * 86400000), subjectSlug: "math", rubricScore: null }, // no score
    ];
    const out = groupSubmissionsForSparklines(subs as any, 30, now);
    expect(out.math.n).toBe(2);
    expect(out.math.avg).toBe(90);
    expect(out.ela.n).toBe(1);
    expect(out.ela.avg).toBe(70);
    expect(out.math.values).toEqual([100, 80]); // chronological asc
  });

  it("falls back to subjectSlug 'general' when missing", () => {
    const subs = [
      { submittedAt: new Date(now - 1 * 86400000), rubricScore: 60 },
    ];
    const out = groupSubmissionsForSparklines(subs as any, 30, now);
    expect(out.general.n).toBe(1);
    expect(out.general.avg).toBe(60);
  });

  it("returns empty when no graded subs", () => {
    expect(groupSubmissionsForSparklines([], 30, now)).toEqual({});
  });
});
