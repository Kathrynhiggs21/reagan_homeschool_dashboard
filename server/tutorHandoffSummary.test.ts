import { describe, it, expect } from "vitest";
import { buildTutorHandoffSummary, type RecentGrade, type RecentTopicCovered, type ReaganRequestRow } from "./_lib/tutorHandoffSummary";

const GRADES: RecentGrade[] = [
  { subject: "math", topic: "Long division", scorePct: 55, schoolDayISO: "2026-05-12" },
  { subject: "math", topic: "Long division", scorePct: 60, schoolDayISO: "2026-05-13" },
  { subject: "math", topic: "Multiplication facts", scorePct: 92, schoolDayISO: "2026-05-13" },
  { subject: "ela", topic: "Spelling", scorePct: 85, schoolDayISO: "2026-05-12" },
];
const COVERED: RecentTopicCovered[] = [
  { subject: "math", topic: "Long division", schoolDayISO: "2026-05-12" },
  { subject: "math", topic: "Multiplication facts", schoolDayISO: "2026-05-13" },
  { subject: "science", topic: "Bird migration", schoolDayISO: "2026-05-13", offPlan: true },
];
const REQUESTS: ReaganRequestRow[] = [
  { raw: "Can we do more bird-watching", schoolDayISO: "2026-05-13", subjectHint: "science" },
  { raw: "I'd like more art please", schoolDayISO: "2026-05-12", subjectHint: "specials" },
];

describe("Push 166 — buildTutorHandoffSummary", () => {
  it("rejects bad input", () => {
    expect(() => buildTutorHandoffSummary(null as any)).toThrow();
    expect(() => buildTutorHandoffSummary({ studentName: "R", tutorName: "T", tutorSubject: "math", recentGrades: [], recentTopicsCovered: [], sessionDayISO: "bad" } as any)).toThrow();
  });

  it("identifies the lowest-avg topic in the tutor's subject as weak focus", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Mr. Sam",
      tutorSubject: "math",
      recentGrades: GRADES,
      recentTopicsCovered: COVERED,
      recentRequests: REQUESTS,
      sessionDayISO: "2026-05-15",
    });
    expect(r.weakTopic).toBe("Long division");
    expect(r.weakAvgPct).toBeLessThan(70);
    expect(r.tutorBriefMarkdown).toMatch(/Focus on:.*Long division/);
  });

  it("calls out a separate recent-win topic", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Mr. Sam",
      tutorSubject: "math",
      recentGrades: GRADES,
      recentTopicsCovered: COVERED,
      sessionDayISO: "2026-05-15",
    });
    expect(r.recentWinTopic).toBe("Multiplication facts");
    expect(r.tutorBriefMarkdown).toMatch(/Recent win:.*Multiplication facts/);
  });

  it("does NOT duplicate weak as recent-win when only one topic exists", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Mr. Sam",
      tutorSubject: "math",
      recentGrades: [{ subject: "math", topic: "Fractions", scorePct: 70, schoolDayISO: "2026-05-13" }],
      recentTopicsCovered: COVERED,
      sessionDayISO: "2026-05-15",
    });
    expect(r.weakTopic).toBe("Fractions");
    expect(r.recentWinTopic).toBeNull();
  });

  it("surfaces Reagan-side interests", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Mr. Sam",
      tutorSubject: "math",
      recentGrades: GRADES,
      recentTopicsCovered: COVERED,
      recentRequests: REQUESTS,
      sessionDayISO: "2026-05-15",
    });
    expect(r.reaganInterests.length).toBeGreaterThan(0);
    expect(r.tutorBriefMarkdown).toMatch(/asked for:/i);
  });

  it("strips politeness prefixes from requests", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Ms. Lee",
      tutorSubject: "ela",
      recentGrades: [],
      recentTopicsCovered: [],
      recentRequests: [
        { raw: "Can we do poetry today", schoolDayISO: "2026-05-13" },
        { raw: "I'd like more reading time please", schoolDayISO: "2026-05-13" },
      ],
      sessionDayISO: "2026-05-15",
    });
    expect(r.reaganInterests[0]).not.toMatch(/^can we/i);
    expect(r.reaganInterests[1]).not.toMatch(/^i'd like/i);
  });

  it("kid-line uses tutor name and weak topic + interest", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Mr. Sam",
      tutorSubject: "math",
      recentGrades: GRADES,
      recentTopicsCovered: COVERED,
      recentRequests: REQUESTS,
      sessionDayISO: "2026-05-15",
    });
    expect(r.kidLine).toMatch(/Mr\. Sam/);
    expect(r.kidLine).toMatch(/Long division/);
  });

  it("kid-line falls back to subject when no data", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Coach Kris",
      tutorSubject: "specials",
      recentGrades: [],
      recentTopicsCovered: [],
      sessionDayISO: "2026-05-15",
    });
    expect(r.kidLine).toMatch(/Specials/);
    expect(r.kidLine).toMatch(/Coach Kris/);
  });

  it("never-fail Mom-readable reminder line in tutor brief", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Mr. Sam",
      tutorSubject: "math",
      recentGrades: GRADES,
      recentTopicsCovered: COVERED,
      sessionDayISO: "2026-05-15",
    });
    expect(r.tutorBriefMarkdown).toMatch(/no timers/i);
    expect(r.tutorBriefMarkdown).toMatch(/plain words/i);
    expect(r.tutorBriefMarkdown).toMatch(/easier topic/i);
  });

  it("ranks topic-covered list to 5 max even if many", () => {
    const many: RecentTopicCovered[] = Array.from({ length: 12 }, (_, i) => ({
      subject: "math",
      topic: `Topic ${i + 1}`,
      schoolDayISO: "2026-05-13",
    }));
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Mr. Sam",
      tutorSubject: "math",
      recentGrades: GRADES,
      recentTopicsCovered: many,
      sessionDayISO: "2026-05-15",
    });
    const coveredLine = r.tutorBriefMarkdown.split("\n").find((l) => l.includes("Already covered")) ?? "";
    const commaCount = (coveredLine.match(/,/g) ?? []).length;
    expect(commaCount).toBeLessThanOrEqual(4);
  });

  it("dedupes off-plan topics into reaganInterests", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Mr. Sam",
      tutorSubject: "math",
      recentGrades: [],
      recentTopicsCovered: [
        { subject: "science", topic: "Octopus brains", schoolDayISO: "2026-05-13", offPlan: true },
        { subject: "science", topic: "Octopus brains", schoolDayISO: "2026-05-13", offPlan: true },
      ],
      sessionDayISO: "2026-05-15",
    });
    expect(r.reaganInterests.filter((i) => i.toLowerCase().includes("octopus")).length).toBe(1);
  });

  it("works when grades are even-keeled (no clear weak topic)", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Mr. Sam",
      tutorSubject: "math",
      recentGrades: [
        { subject: "math", topic: "A", scorePct: 80, schoolDayISO: "2026-05-13" },
        { subject: "math", topic: "B", scorePct: 80, schoolDayISO: "2026-05-13" },
      ],
      recentTopicsCovered: [],
      sessionDayISO: "2026-05-15",
    });
    expect(r.weakTopic).not.toBeNull();
    expect(r.tutorBriefMarkdown).toMatch(/Focus on:/);
  });

  it("works when no recent grades for tutor's subject", () => {
    const r = buildTutorHandoffSummary({
      studentName: "Reagan",
      tutorName: "Coach Kris",
      tutorSubject: "specials",
      recentGrades: GRADES, // all math/ela
      recentTopicsCovered: [],
      sessionDayISO: "2026-05-15",
    });
    expect(r.weakTopic).toBeNull();
    expect(r.tutorBriefMarkdown).toMatch(/no recent grades/);
  });
});
