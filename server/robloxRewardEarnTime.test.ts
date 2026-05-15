import { describe, it, expect } from "vitest";
import { computeRobloxEarn } from "./_lib/robloxRewardEarnTime";

const ISO = "2026-05-15";

describe("Push 181 — Roblox reward earn-time helper", () => {
  it("zero work => kid line is gentle, no negativity, no minutes earned today", () => {
    const r = computeRobloxEarn({ isoDate: ISO });
    expect(r.capAppliedMin).toBe(0);
    expect(r.bankAfterMin).toBe(0);
    expect(r.kidLine.toLowerCase()).not.toMatch(/lose|lost|punish|fail|bad/);
    expect(r.kidLine.toLowerCase()).toMatch(/no roblox minutes earned/);
  });

  it("each completed worksheet earns 5 min, capped at 4/day", () => {
    const r = computeRobloxEarn({
      isoDate: ISO,
      worksheetCompletedToday: 7,
    });
    expect(r.lines.find((l) => l.source === "worksheet")?.earnedMin).toBe(20);
    expect(r.capAppliedMin).toBe(20);
  });

  it("each chapter earns 3 min, capped at 5/day", () => {
    const r = computeRobloxEarn({
      isoDate: ISO,
      chaptersFinishedToday: 8,
    });
    expect(r.lines.find((l) => l.source === "chapter")?.earnedMin).toBe(15);
  });

  it("outdoor blocks must be >= 20 min and capped at 2", () => {
    const r = computeRobloxEarn({
      isoDate: ISO,
      outdoorBlocksToday: [
        { durationMin: 10 },
        { durationMin: 20 },
        { durationMin: 30 },
        { durationMin: 25 },
      ],
    });
    expect(r.lines.find((l) => l.source === "outdoor")?.earnedMin).toBe(10);
  });

  it("great-mood full-day bonus only awarded once", () => {
    const r1 = computeRobloxEarn({
      isoDate: ISO,
      moodBandFullDay: "great",
    });
    expect(
      r1.lines.find((l) => l.source === "great_day_bonus")?.earnedMin,
    ).toBe(5);
    const r2 = computeRobloxEarn({
      isoDate: ISO,
      moodBandFullDay: "great",
      greatBandBonusAlreadyAwarded: true,
    });
    expect(r2.lines.find((l) => l.source === "great_day_bonus")).toBeFalsy();
  });

  it("school day cap = 45, weekend cap = 60", () => {
    const wkday = computeRobloxEarn({
      isoDate: ISO,
      worksheetCompletedToday: 4,
      chaptersFinishedToday: 5,
      outdoorBlocksToday: [{ durationMin: 25 }, { durationMin: 25 }],
      moodBandFullDay: "great",
    });
    expect(wkday.dailyCapMin).toBe(45);
    expect(wkday.capAppliedMin).toBe(45);

    const weekend = computeRobloxEarn({
      isoDate: ISO,
      isWeekend: true,
      worksheetCompletedToday: 4,
      chaptersFinishedToday: 5,
      outdoorBlocksToday: [{ durationMin: 25 }, { durationMin: 25 }],
      moodBandFullDay: "great",
    });
    expect(weekend.dailyCapMin).toBe(60);
    expect(weekend.capAppliedMin).toBe(50);
  });

  it("bank rolls forward unused minutes up to a 90-min ceiling", () => {
    const r = computeRobloxEarn({
      isoDate: ISO,
      worksheetCompletedToday: 4,
      bankCarriedFromYesterdayMin: 80,
    });
    expect(r.bankAfterMin).toBe(90);
    expect(r.bankCeilingMin).toBe(90);
    expect(r.lines[0]?.source).toBe("carry_in");
  });

  it("kid line never says lose/lost/punish/bad/fail", () => {
    const r = computeRobloxEarn({
      isoDate: ISO,
      worksheetCompletedToday: 1,
    });
    const k = r.kidLine.toLowerCase();
    for (const banned of ["lose", "lost", "punish", "bad", "fail"]) {
      expect(k).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });
});
