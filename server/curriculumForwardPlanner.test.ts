import { describe, it, expect } from "vitest";
import {
  planForward,
  type GapBySubject,
  type WeeklyShape,
} from "./_lib/curriculumForwardPlanner";

const M = (id: number, code: string, title: string, status: any = "notStarted", notes: string | null = null) => ({
  id,
  subject: "Math",
  code,
  title,
  status,
  notes,
  ord: id,
});
const E = (id: number, code: string, title: string, status: any = "notStarted") => ({
  id,
  subject: "ELA",
  code,
  title,
  status,
  notes: null,
  ord: id,
});
const S = (id: number, code: string, title: string, status: any = "notStarted") => ({
  id,
  subject: "Science",
  code,
  title,
  status,
  notes: null,
  ord: id,
});

const FIVE_DAY_SHAPE: WeeklyShape = {
  // Mon-Fri school week, three slots per day, Math first
  1: ["Math", "ELA", "Science"],
  2: ["Math", "ELA", "Science"],
  3: ["Math", "ELA", "Science"],
  4: ["Math", "ELA", "Science"],
  5: ["Math", "ELA", "Science"],
};

function fullGap(): GapBySubject {
  return {
    Math: {
      inProgress: [M(101, "M5-1", "Final test (ungraded)", "inProgress", "Spectrum Math final"), M(102, "M5-2", "Multiplying multi-digit", "inProgress", "more multiplying")],
      notStarted: [M(110, "M6-1", "Ordered pairs"), M(111, "M6-2", "Patterns"), M(112, "M6-3", "Quadrilaterals")],
    },
    ELA: {
      inProgress: [E(201, "E5-1", "Vocab review", "inProgress")],
      notStarted: [E(210, "E6-1", "Author's purpose"), E(211, "E6-2", "Theme")],
    },
    Science: {
      inProgress: [],
      notStarted: [S(310, "S4-1", "Anatomy of an atom (next chapter)"), S(311, "S4-2", "Properties of matter")],
    },
  };
}

describe("planForward (pure)", () => {
  it("emits at most horizonDays * slotsPerDay rows", () => {
    const rows = planForward({
      gap: fullGap(),
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: 5,
      startDate: "2026-05-18", // Monday
    });
    // 5 days × 3 slots = at most 15 rows
    expect(rows.length).toBeLessThanOrEqual(15);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("front-loads transcript blockers into the first 3 school days", () => {
    const rows = planForward({
      gap: fullGap(),
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: 10,
      startDate: "2026-05-18", // Monday
      transcriptBlockerTopicIds: [101, 102, 310], // 2 Math + 1 Science blocker
    });
    const blockerRows = rows.filter((r) => r.isBlockerFrontload);
    expect(blockerRows.length).toBe(3);
    // All 3 must be in the first 3 unique school days.
    const firstThreeDates = Array.from(new Set(rows.map((r) => r.date))).slice(0, 3);
    for (const br of blockerRows) {
      expect(firstThreeDates).toContain(br.date);
    }
  });

  it("skips weekends when excludeWeekends=true", () => {
    const rows = planForward({
      gap: fullGap(),
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: 5,
      startDate: "2026-05-16", // Saturday
    });
    // First school day must be Monday 2026-05-18, never the weekend.
    const dates = Array.from(new Set(rows.map((r) => r.date))).sort();
    expect(dates[0]).toBe("2026-05-18");
    for (const r of rows) {
      expect(r.weekday).toBeGreaterThan(0);
      expect(r.weekday).toBeLessThan(6);
    }
  });

  it("is deterministic — same inputs produce identical outputs", () => {
    const a = planForward({
      gap: fullGap(),
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: 5,
      startDate: "2026-05-18",
      transcriptBlockerTopicIds: [101, 310],
    });
    const b = planForward({
      gap: fullGap(),
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: 5,
      startDate: "2026-05-18",
      transcriptBlockerTopicIds: [101, 310],
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("prefers inProgress over notStarted within a subject", () => {
    const rows = planForward({
      gap: fullGap(),
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: 1,
      startDate: "2026-05-18",
    });
    // Day 1: Math first slot should be M5-1 (inProgress 101) before any notStarted.
    const mathDay1 = rows.find((r) => r.date === "2026-05-18" && r.subject === "Math" && r.slotIndex === 0);
    expect(mathDay1?.code).toBe("M5-1");
  });

  it("excludes a subject when its gap is empty (don't emit empty slots)", () => {
    const partial: GapBySubject = {
      Math: { inProgress: [M(101, "M5-1", "x")], notStarted: [] },
      // ELA + Science left out entirely
    };
    const rows = planForward({
      gap: partial,
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: 3,
      startDate: "2026-05-18",
    });
    for (const r of rows) {
      expect(r.subject).toBe("Math");
    }
  });

  it("clamps horizonDays into [1, 60]", () => {
    const rowsLow = planForward({
      gap: fullGap(),
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: -10,
      startDate: "2026-05-18",
    });
    const rowsHigh = planForward({
      gap: fullGap(),
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: 9999,
      startDate: "2026-05-18",
    });
    // Low clamps to 1 day -> at most 3 rows (but gap may exhaust)
    const lowDates = Array.from(new Set(rowsLow.map((r) => r.date)));
    expect(lowDates.length).toBeLessThanOrEqual(1);
    // High clamps to 60 — gap is small so rows will be far fewer than that.
    expect(rowsHigh.length).toBeLessThanOrEqual(60 * 3);
  });

  it("preserves the evidence string from notes", () => {
    const rows = planForward({
      gap: fullGap(),
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: 5,
      startDate: "2026-05-18",
    });
    const finalTest = rows.find((r) => r.code === "M5-1");
    expect(finalTest?.evidence).toBe("Spectrum Math final");
  });

  it("does not double-book a topic id", () => {
    const rows = planForward({
      gap: fullGap(),
      weeklyShape: FIVE_DAY_SHAPE,
      horizonDays: 10,
      startDate: "2026-05-18",
    });
    const ids = rows.map((r) => r.topicId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
