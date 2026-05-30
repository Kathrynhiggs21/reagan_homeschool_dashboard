import { describe, it, expect, vi } from "vitest";
import {
  seedSixthGradeLadder,
  SIXTH_GRADE_LADDER_ROWS,
} from "./_lib/seedSixthGradeLadder";

describe("seedSixthGradeLadder", () => {
  it("inserts every row when ladder is empty", async () => {
    const inserted: string[] = [];
    const result = await seedSixthGradeLadder({
      lookupExisting: async () => new Set<string>(),
      insertRow: async (row) => {
        inserted.push(row.skillCode);
      },
    });
    expect(result.inserted).toBe(SIXTH_GRADE_LADDER_ROWS.length);
    expect(result.skipped).toBe(0);
    expect(inserted.length).toBe(SIXTH_GRADE_LADDER_ROWS.length);
  });

  it("skips rows whose skillCode is already in the ladder", async () => {
    const existing = new Set(["OH.6.RP.1", "OH.6.RL.2", "OH.6.LS.1"]);
    const inserter = vi.fn(async () => {});
    const result = await seedSixthGradeLadder({
      lookupExisting: async () => existing,
      insertRow: inserter,
    });
    expect(result.skipped).toBe(3);
    expect(result.inserted).toBe(SIXTH_GRADE_LADDER_ROWS.length - 3);
    expect(inserter).toHaveBeenCalledTimes(SIXTH_GRADE_LADDER_ROWS.length - 3);
  });

  it("is idempotent across re-runs", async () => {
    const seen = new Set<string>();
    const insertRow = async (row: any) => {
      seen.add(row.skillCode);
    };
    const lookupExisting = async () => new Set(seen);

    const r1 = await seedSixthGradeLadder({ lookupExisting, insertRow });
    const r2 = await seedSixthGradeLadder({ lookupExisting, insertRow });

    expect(r1.inserted).toBe(SIXTH_GRADE_LADDER_ROWS.length);
    expect(r2.inserted).toBe(0);
    expect(r2.skipped).toBe(SIXTH_GRADE_LADDER_ROWS.length);
  });

  it("includes all four subjects + reasonable count per subject", () => {
    const bySubject: Record<string, number> = {};
    for (const r of SIXTH_GRADE_LADDER_ROWS) {
      bySubject[r.subjectSlug] = (bySubject[r.subjectSlug] ?? 0) + 1;
    }
    expect(bySubject["math"]).toBeGreaterThanOrEqual(6);
    expect(bySubject["ela"]).toBeGreaterThanOrEqual(4);
    expect(bySubject["science"]).toBeGreaterThanOrEqual(3);
    expect(bySubject["ss"]).toBeGreaterThanOrEqual(3);
  });

  it("uses ladderOrder >= 6000 to sort after 5th-grade rows", () => {
    for (const r of SIXTH_GRADE_LADDER_ROWS) {
      expect(r.ladderOrder).toBeGreaterThanOrEqual(6000);
    }
  });

  it("uses Ohio standards code format (OH.6.<strand>.<n>)", () => {
    for (const r of SIXTH_GRADE_LADDER_ROWS) {
      expect(r.skillCode).toMatch(/^OH\.6\.[A-Z]+\.\d+$/);
    }
  });

  it("has unique skillCodes (no dupe seeds)", () => {
    const codes = SIXTH_GRADE_LADDER_ROWS.map((r) => r.skillCode);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
