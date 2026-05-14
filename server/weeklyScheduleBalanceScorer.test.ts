import { describe, expect, it } from "vitest";
import {
  CANONICAL_SUBJECTS,
  scoreWeeklyScheduleBalance,
} from "./_lib/weeklyScheduleBalanceScorer";

describe("Push 142 — weekly schedule balance scorer", () => {
  it("returns Empty headline on no blocks", () => {
    const r = scoreWeeklyScheduleBalance([]);
    expect(r.headline).toBe("Empty");
    expect(r.tone).toBe("info");
    expect(r.totalMinutes).toBe(0);
    expect(r.subjectsCovered).toEqual([]);
    expect(r.subjectsMissing.length).toBe(CANONICAL_SUBJECTS.length);
  });

  it("excludes morning_vibe (Slay Charge ⚡) from totals", () => {
    const r = scoreWeeklyScheduleBalance([
      {
        dateIso: "2026-05-11",
        blockType: "morning_vibe",
        subject: "ela",
        estMinutes: 5,
      },
      {
        dateIso: "2026-05-11",
        blockType: "morning_warmup",
        subject: "math",
        estMinutes: 5,
      },
    ]);
    expect(r.totalMinutes).toBe(0);
    expect(r.totalBlocks).toBe(0);
  });

  it("flags Outdoor-rich when outdoor share ≥ 35%", () => {
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-11", subject: "math", estMinutes: 30 },
      { dateIso: "2026-05-11", subject: "ela", estMinutes: 30 },
      { dateIso: "2026-05-12", subject: "science", estMinutes: 60, isOutdoor: true },
      { dateIso: "2026-05-13", subject: "social-studies", estMinutes: 30 },
    ]);
    expect(r.headline).toBe("Outdoor-rich");
    expect(r.tone).toBe("good");
    expect(r.outdoorMinutes).toBe(60);
  });

  it("flags Desk-heavy when desk share ≥ 85%", () => {
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-11", subject: "math", estMinutes: 60 },
      { dateIso: "2026-05-11", subject: "ela", estMinutes: 60 },
      { dateIso: "2026-05-11", subject: "science", estMinutes: 60 },
      { dateIso: "2026-05-12", subject: "specials", estMinutes: 30, isOutdoor: true },
    ]);
    expect(r.headline).toBe("Desk-heavy");
    expect(r.tone).toBe("warn");
  });

  it("flags Subject-narrow when ≤ 2 canonical subjects covered", () => {
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-11", subject: "math", estMinutes: 60 },
      { dateIso: "2026-05-11", subject: "ela", estMinutes: 60 },
    ]);
    expect(r.headline).toBe("Subject-narrow");
    expect(r.tone).toBe("warn");
  });

  it("flags Light when total < 60 minutes", () => {
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-11", subject: "math", estMinutes: 20 },
      { dateIso: "2026-05-12", subject: "ela", estMinutes: 20 },
    ]);
    expect(r.headline).toBe("Light");
    expect(r.tone).toBe("info");
  });

  it("returns Balanced when 3+ subjects, moderate desk and not outdoor-rich", () => {
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-11", subject: "math", estMinutes: 30 },
      { dateIso: "2026-05-12", subject: "ela", estMinutes: 30 },
      { dateIso: "2026-05-13", subject: "science", estMinutes: 30, isOutdoor: true },
      { dateIso: "2026-05-14", subject: "social-studies", estMinutes: 30 },
    ]);
    expect(r.headline).toBe("Balanced");
    expect(r.tone).toBe("good");
  });

  it("warns when any single day exceeds 180 desk minutes", () => {
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-11", subject: "math", estMinutes: 90 },
      { dateIso: "2026-05-11", subject: "ela", estMinutes: 90 },
      { dateIso: "2026-05-11", subject: "science", estMinutes: 30 },
      { dateIso: "2026-05-12", subject: "specials", estMinutes: 30 },
      { dateIso: "2026-05-13", subject: "social-studies", estMinutes: 30, isOutdoor: true },
    ]);
    expect(r.overDeskCapDays).toEqual(["2026-05-11"]);
    expect(r.tone).toBe("warn");
  });

  it("ignores invalid blocks (NaN minutes, blank type, malformed date stays)", () => {
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-11", subject: "math", estMinutes: 60 },
      { dateIso: "2026-05-12", subject: "ela", estMinutes: Number.NaN as any },
      null as any,
      { dateIso: "not-a-date", subject: "science", estMinutes: 30, isOutdoor: true },
    ]);
    expect(r.totalMinutes).toBe(90);
    expect(r.includesWeekend).toBe(false);
  });

  it("flags includesWeekend when a Sat/Sun block has minutes", () => {
    // 2026-05-09 is a Saturday
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-09", subject: "science", estMinutes: 60, isOutdoor: true },
    ]);
    expect(r.includesWeekend).toBe(true);
  });

  it("treats unknown subjects as 'other' (counted in minutes, not in variety)", () => {
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-11", subject: "lunch", estMinutes: 30 },
      { dateIso: "2026-05-11", subject: "math", estMinutes: 30 },
      { dateIso: "2026-05-12", subject: "ela", estMinutes: 30 },
      { dateIso: "2026-05-13", subject: "science", estMinutes: 30 },
    ]);
    expect(r.totalMinutes).toBe(120);
    expect(r.subjectsCovered).toEqual(["math", "ela", "science"]);
  });

  it("variety score = covered/5", () => {
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-11", subject: "math", estMinutes: 30 },
      { dateIso: "2026-05-12", subject: "ela", estMinutes: 30 },
      { dateIso: "2026-05-13", subject: "science", estMinutes: 30 },
      { dateIso: "2026-05-14", subject: "social-studies", estMinutes: 30 },
      { dateIso: "2026-05-15", subject: "specials", estMinutes: 30 },
    ]);
    expect(r.subjectVarietyScore).toBe(1);
    expect(r.subjectsMissing).toEqual([]);
  });

  it("subject matching is case-insensitive", () => {
    const r = scoreWeeklyScheduleBalance([
      { dateIso: "2026-05-11", subject: "MATH", estMinutes: 30 },
      { dateIso: "2026-05-12", subject: "Ela", estMinutes: 30 },
      { dateIso: "2026-05-13", subject: "SCIENCE", estMinutes: 30 },
    ]);
    expect(r.subjectsCovered).toEqual(["math", "ela", "science"]);
  });

  it("non-array input returns Empty cleanly", () => {
    const r = scoreWeeklyScheduleBalance(null);
    expect(r.headline).toBe("Empty");
    expect(r.totalMinutes).toBe(0);
  });
});
