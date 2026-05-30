/**
 * Verifies the completedTopics rollup behavior surfaced by
 * `fifthGradeReportCard()` in server/db.ts. We re-create the rollup logic
 * here as a pure function (the real one is wrapped in a drizzle query,
 * so we test the deterministic ordering & filter behavior).
 *
 * Contract being locked:
 *   1. Only rows with band === "mastered" appear in completedTopics.
 *   2. completedTopics is sorted newest-first by lastPracticedAt.
 *   3. Rows with null lastPracticedAt sort to the end (treated as 0 epoch).
 *   4. Rows from any subject are flattened into one list.
 */
import { describe, it, expect } from "vitest";

type Band = "mastered" | "on track" | "working on it" | "not yet";

interface Row {
  skillId: number;
  title: string;
  band: Band;
  lastPracticedAt: Date | null;
}

function rollupCompletedTopics(bySubject: Record<string, Row[]>): Row[] {
  const completedTopics: Row[] = [];
  for (const subjectRows of Object.values(bySubject)) {
    for (const row of subjectRows) {
      if (row.band === "mastered") completedTopics.push(row);
    }
  }
  completedTopics.sort((a, b) => {
    const at = a.lastPracticedAt ? new Date(a.lastPracticedAt).getTime() : 0;
    const bt = b.lastPracticedAt ? new Date(b.lastPracticedAt).getTime() : 0;
    return bt - at;
  });
  return completedTopics;
}

describe("fifthGradeReportCard.completedTopics rollup", () => {
  it("filters out non-mastered rows", () => {
    const bySubject: Record<string, Row[]> = {
      math: [
        { skillId: 1, title: "Fractions", band: "mastered", lastPracticedAt: new Date("2026-01-15") },
        { skillId: 2, title: "Decimals", band: "on track", lastPracticedAt: new Date("2026-01-20") },
        { skillId: 3, title: "Long division", band: "working on it", lastPracticedAt: new Date("2026-01-22") },
        { skillId: 4, title: "Order of ops", band: "not yet", lastPracticedAt: null },
      ],
    };
    const result = rollupCompletedTopics(bySubject);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Fractions");
  });

  it("sorts mastered rows newest-first by lastPracticedAt", () => {
    const bySubject: Record<string, Row[]> = {
      math: [
        { skillId: 1, title: "Older", band: "mastered", lastPracticedAt: new Date("2026-01-01") },
        { skillId: 2, title: "Newer", band: "mastered", lastPracticedAt: new Date("2026-03-01") },
        { skillId: 3, title: "Middle", band: "mastered", lastPracticedAt: new Date("2026-02-01") },
      ],
    };
    const result = rollupCompletedTopics(bySubject);
    expect(result.map((r) => r.title)).toEqual(["Newer", "Middle", "Older"]);
  });

  it("rows with null lastPracticedAt sort to the end", () => {
    const bySubject: Record<string, Row[]> = {
      ela: [
        { skillId: 1, title: "Has date", band: "mastered", lastPracticedAt: new Date("2026-01-01") },
        { skillId: 2, title: "No date", band: "mastered", lastPracticedAt: null },
      ],
    };
    const result = rollupCompletedTopics(bySubject);
    expect(result[0].title).toBe("Has date");
    expect(result[1].title).toBe("No date");
  });

  it("flattens across subjects into a single list", () => {
    const bySubject: Record<string, Row[]> = {
      math: [{ skillId: 1, title: "M1", band: "mastered", lastPracticedAt: new Date("2026-01-10") }],
      ela: [{ skillId: 2, title: "E1", band: "mastered", lastPracticedAt: new Date("2026-01-20") }],
      science: [{ skillId: 3, title: "S1", band: "mastered", lastPracticedAt: new Date("2026-01-15") }],
    };
    const result = rollupCompletedTopics(bySubject);
    expect(result).toHaveLength(3);
    // Newest-first: ELA(20) > Science(15) > Math(10)
    expect(result.map((r) => r.title)).toEqual(["E1", "S1", "M1"]);
  });

  it("returns an empty list when no rows are mastered", () => {
    const bySubject: Record<string, Row[]> = {
      math: [
        { skillId: 1, title: "Fractions", band: "on track", lastPracticedAt: new Date("2026-01-15") },
        { skillId: 2, title: "Decimals", band: "working on it", lastPracticedAt: null },
      ],
    };
    const result = rollupCompletedTopics(bySubject);
    expect(result).toEqual([]);
  });

  it("returns an empty list when bySubject is empty", () => {
    expect(rollupCompletedTopics({})).toEqual([]);
  });
});
