/**
 * Overnight push 2026-05-14 — kid + Grandma readable daily summary contract.
 *
 * Validates plain-English headlines, per-subject lines, Grandma line, and
 * the totals chip math. Pure helper, deterministic.
 */
import { describe, it, expect } from "vitest";
import { buildDailyKidSummary } from "./_lib/dailyKidSummary";

describe("buildDailyKidSummary", () => {
  it("handles a not-started day with zero work", () => {
    const r = buildDailyKidSummary({
      forDate: "2026-05-15",
      studentName: "Reagan",
      grades: [],
      timeBySubjectMin: {},
    });
    expect(r.headline).toBe("Reagan hasn't started yet today.");
    expect(r.perSubjectLines).toEqual([]);
    expect(r.grandmaLine).toBe("");
    expect(r.totals.averageScore).toBeNull();
    expect(r.totals.minutesTotal).toBe(0);
    expect(r.totals.subjectsCovered).toBe(0);
  });

  it("handles a 'worked but no grades yet' day", () => {
    const r = buildDailyKidSummary({
      forDate: "2026-05-15",
      studentName: "Reagan",
      grades: [],
      timeBySubjectMin: { Math: 25, Reading: 30 },
    });
    expect(r.headline).toBe("Reagan worked for 55 minutes today.");
    expect(r.perSubjectLines).toEqual([
      "Math: worked for 25 minutes.",
      "Reading: worked for 30 minutes.",
    ]);
    expect(r.grandmaLine).toBe("");
    expect(r.totals.minutesTotal).toBe(55);
    expect(r.totals.subjectsCovered).toBe(2);
  });

  it("declares a great day and praises a subject for Grandma", () => {
    const r = buildDailyKidSummary({
      forDate: "2026-05-15",
      studentName: "Reagan",
      grades: [
        { subjectName: "Math", autoScore: 95, title: "Place Value" },
        { subjectName: "Reading", autoScore: 92 },
      ],
      timeBySubjectMin: { Math: 30, Reading: 25 },
    });
    expect(r.headline).toBe("Reagan had a great day.");
    expect(r.perSubjectLines).toEqual([
      "Math: did great for 30 minutes.",
      "Reading: did great for 25 minutes.",
    ]);
    expect(r.grandmaLine).toBe(
      "Tell Reagan you noticed she did great in Math.",
    );
    expect(r.totals.averageScore).toBe(94);
    expect(r.totals.minutesTotal).toBe(55);
    expect(r.totals.subjectsCovered).toBe(2);
  });

  it("declares a hard day and asks Grandma to ask about the tricky subject", () => {
    const r = buildDailyKidSummary({
      forDate: "2026-05-15",
      studentName: "Reagan",
      grades: [
        { subjectName: "Math", autoScore: 60, title: "Decimals" },
        { subjectName: "Reading", autoScore: 78 },
      ],
      timeBySubjectMin: { Math: 40, Reading: 20 },
    });
    expect(r.headline).toBe("Reagan had a hard day but kept going.");
    expect(r.perSubjectLines).toEqual([
      "Math: found some parts tricky for 40 minutes.",
      "Reading: did well for 20 minutes.",
    ]);
    expect(r.grandmaLine).toBe(
      "Ask Reagan what was tricky about Math today.",
    );
  });

  it("reports pages read from booksRead total", () => {
    const r = buildDailyKidSummary({
      forDate: "2026-05-15",
      studentName: "Reagan",
      grades: [{ subjectName: "Reading", autoScore: 88 }],
      timeBySubjectMin: { Reading: 25 },
      booksRead: [
        { bookTitle: "Tuck Everlasting", pages: 12 },
        { bookTitle: "Spectrum Science", pages: 6 },
      ],
    });
    expect(r.totals.pagesRead).toBe(18);
  });

  it("singularizes 'minute' correctly", () => {
    const r = buildDailyKidSummary({
      forDate: "2026-05-15",
      studentName: "Reagan",
      grades: [],
      timeBySubjectMin: { Math: 1 },
    });
    expect(r.headline).toBe("Reagan worked for 1 minute today.");
    expect(r.perSubjectLines).toEqual(["Math: worked for 1 minute."]);
  });

  it("never emits empty Grandma line on a graded day", () => {
    const r = buildDailyKidSummary({
      forDate: "2026-05-15",
      studentName: "Reagan",
      grades: [{ subjectName: "Math", autoScore: 80 }],
      timeBySubjectMin: { Math: 20 },
    });
    expect(r.grandmaLine.length).toBeGreaterThan(0);
    expect(r.grandmaLine).toContain("Reagan");
  });
});
