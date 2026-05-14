import { describe, it, expect } from "vitest";
import { buildDailyMomBriefing } from "./_lib/dailyMomBriefing";
import type { KiwiMoodReading } from "./_lib/kiwiMoodTracker";

const ISO = "2026-05-14";

function reading(
  band: KiwiMoodReading["band"],
  score: number,
  i: number = 0,
): KiwiMoodReading {
  return {
    band,
    score,
    headline: `block ${i} ${band}`,
    suggestion: band === "great" ? "" : "let's pause",
    suggestedAdjustment: band === "frustrated" ? "shorten_next" : "none",
    blockSortOrder: i,
    blockTitle: `Block ${i}`,
  } as KiwiMoodReading;
}

const baseInput = {
  schoolDayISO: ISO,
  kidName: "Reagan",
  grades: [
    { subjectName: "Math", autoScore: 92, title: "Place Value Practice" },
    { subjectName: "Reading", autoScore: 88, title: "Charlotte's Web ch.3" },
  ],
  timeBySubjectMin: { Math: 30, Reading: 25 },
  totalMinutesOnTask: 55,
  totalMinutesPlanned: 60,
  moodReadings: [reading("great", 90, 0), reading("okay", 70, 1)],
};

describe("Push 161 — buildDailyMomBriefing", () => {
  it("rejects bad ISO date", () => {
    expect(() => buildDailyMomBriefing({ ...baseInput, schoolDayISO: "today" })).toThrow();
  });

  it("rejects empty kidName", () => {
    expect(() => buildDailyMomBriefing({ ...baseInput, kidName: " " })).toThrow();
  });

  it("includes the date heading + plain-English summary in markdownBody", () => {
    const r = buildDailyMomBriefing(baseInput);
    expect(r.markdownBody).toContain(`# Reagan's day — ${ISO}`);
    expect(r.kidSummary.headline.length).toBeGreaterThan(0);
    expect(r.markdownBody).toContain(r.kidSummary.headline);
  });

  it("planned vs actual: on plan", () => {
    const r = buildDailyMomBriefing({ ...baseInput, totalMinutesOnTask: 60, totalMinutesPlanned: 60 });
    expect(r.plannedVsActualLine).toMatch(/right on plan/);
    expect(r.markdownBody).toContain(r.plannedVsActualLine);
  });

  it("planned vs actual: over-run", () => {
    const r = buildDailyMomBriefing({ ...baseInput, totalMinutesOnTask: 80, totalMinutesPlanned: 60 });
    expect(r.plannedVsActualLine).toMatch(/went 20 min over/);
  });

  it("planned vs actual: short", () => {
    const r = buildDailyMomBriefing({ ...baseInput, totalMinutesOnTask: 30, totalMinutesPlanned: 60 });
    expect(r.plannedVsActualLine).toMatch(/30 min short of plan/);
  });

  it("mood line surfaces band words", () => {
    const r = buildDailyMomBriefing({
      ...baseInput,
      moodReadings: [reading("frustrated", 30, 0)],
    });
    expect(r.markdownBody.toLowerCase()).toContain("frustrated");
  });

  it("notification headline includes date + minute ratio + mood band", () => {
    const r = buildDailyMomBriefing(baseInput);
    expect(r.notificationHeadline).toContain(ISO);
    expect(r.notificationHeadline).toMatch(/55\/60 min/);
    expect(r.notificationHeadline.toLowerCase()).toContain("mood:");
  });

  it("includes worksheet attachment count when present", () => {
    const r = buildDailyMomBriefing({ ...baseInput, worksheetsAttached: 3 });
    expect(r.markdownBody).toMatch(/3 worksheet printables are attached/);
    const r1 = buildDailyMomBriefing({ ...baseInput, worksheetsAttached: 1 });
    expect(r1.markdownBody).toMatch(/1 worksheet printable is attached/);
  });

  it("includes extra topics covered (off-curriculum)", () => {
    const r = buildDailyMomBriefing({
      ...baseInput,
      extraTopicsCovered: [{ subject: "Science", label: "Octopus arms" }],
    });
    expect(r.markdownBody).toMatch(/Extra topic covered today/);
    expect(r.markdownBody).toMatch(/Octopus arms \(Science\)/);
  });

  it("returns mood roll-up + kid summary so caller can persist them", () => {
    const r = buildDailyMomBriefing(baseInput);
    expect(r.moodRollup.band).toMatch(/great|okay|tired|frustrated/);
    expect(typeof r.kidSummary.headline).toBe("string");
  });

  it("nothing logged today: 'nothing logged' line", () => {
    const r = buildDailyMomBriefing({
      ...baseInput,
      totalMinutesOnTask: 0,
      totalMinutesPlanned: 0,
      grades: [],
      timeBySubjectMin: {},
      moodReadings: [],
    });
    expect(r.plannedVsActualLine).toMatch(/nothing logged today yet/);
  });
});
