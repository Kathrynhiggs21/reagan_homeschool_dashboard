import { describe, it, expect } from "vitest";
import { computeMultiDayMoodTrend } from "./_lib/multiDayMoodTrend";

const today = "2026-05-15";

function isoDaysBefore(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

describe("Push 176 — multi-day mood trend", () => {
  it("emits no notice when there isn't enough data", () => {
    const r = computeMultiDayMoodTrend({
      todayISO: today,
      records: [
        { iso: today, mood: "okay" },
        { iso: isoDaysBefore(today, 1), mood: "tired" },
      ],
    });
    expect(r.notice).toBe(false);
    expect(r.headline).toMatch(/Not enough mood notes|quieter/i);
  });

  it("celebrates a great stretch", () => {
    const records = [];
    for (let i = 0; i < 7; i++) {
      records.push({ iso: isoDaysBefore(today, i), mood: "great" });
    }
    for (let i = 7; i < 14; i++) {
      records.push({ iso: isoDaysBefore(today, i), mood: "okay" });
    }
    const r = computeMultiDayMoodTrend({ todayISO: today, records });
    expect(r.notice).toBe(false);
    expect(r.headline).toMatch(/great stretch/i);
  });

  it("fires a respectful notice when recent week is much worse", () => {
    const records = [];
    for (let i = 0; i < 7; i++) {
      records.push({ iso: isoDaysBefore(today, i), mood: "tired" });
    }
    for (let i = 7; i < 14; i++) {
      records.push({ iso: isoDaysBefore(today, i), mood: "great" });
    }
    const r = computeMultiDayMoodTrend({ todayISO: today, records });
    expect(r.notice).toBe(true);
    expect(r.headline).toMatch(/last few days/i);
    expect(r.suggestion).toMatch(/lighter day/i);
    // No clinical / negative language.
    const banned =
      /\bregress|broken|concerning|adhd|autism|disorder|depress|anxious|pathologic|abnormal/i;
    expect(r.headline + " " + r.suggestion).not.toMatch(banned);
  });

  it("does not fire when delta is small even if recent is meh", () => {
    const records = [];
    for (let i = 0; i < 7; i++) {
      records.push({ iso: isoDaysBefore(today, i), mood: "tired" });
    }
    for (let i = 7; i < 14; i++) {
      records.push({ iso: isoDaysBefore(today, i), mood: "tired" });
    }
    const r = computeMultiDayMoodTrend({ todayISO: today, records });
    expect(r.notice).toBe(false);
  });

  it("drops invalid mood values silently", () => {
    const records = [];
    for (let i = 0; i < 7; i++) {
      records.push({ iso: isoDaysBefore(today, i), mood: "great" });
    }
    for (let i = 7; i < 14; i++) {
      records.push({ iso: isoDaysBefore(today, i), mood: "ecstatic" });
    }
    const r = computeMultiDayMoodTrend({ todayISO: today, records });
    expect(r.priorDays).toBe(0);
    expect(r.notice).toBe(false);
  });

  it("is deterministic — same input -> same output", () => {
    const records = [
      { iso: today, mood: "okay" as const },
      { iso: isoDaysBefore(today, 1), mood: "tired" as const },
      { iso: isoDaysBefore(today, 2), mood: "tired" as const },
      { iso: isoDaysBefore(today, 3), mood: "frustrated" as const },
      { iso: isoDaysBefore(today, 8), mood: "great" as const },
      { iso: isoDaysBefore(today, 9), mood: "great" as const },
      { iso: isoDaysBefore(today, 10), mood: "okay" as const },
    ];
    const a = computeMultiDayMoodTrend({ todayISO: today, records });
    const b = computeMultiDayMoodTrend({ todayISO: today, records });
    expect(a).toEqual(b);
  });

  it("counts only the most recent record per day (last in array wins)", () => {
    const records = [];
    for (let i = 0; i < 7; i++) {
      records.push({ iso: isoDaysBefore(today, i), mood: "tired" });
    }
    for (let i = 7; i < 14; i++) {
      records.push({ iso: isoDaysBefore(today, i), mood: "great" });
    }
    // Add a great today AFTER the tired entry; should win.
    records.push({ iso: today, mood: "great" });
    const r = computeMultiDayMoodTrend({ todayISO: today, records });
    expect(r.recentDays).toBe(7);
    // Recent avg should now be > 1 (since one day is great).
    expect(r.recentAvg).toBeGreaterThan(1);
  });
});
