/**
 * Push 114 (2026-05-13) — Mood weekly-rollup contract.
 */
import { describe, it, expect } from "vitest";
import { rollupMoodWeek } from "./_lib/moodWeeklyRollup";

describe("Push 114 — Mood weekly-rollup", () => {
  it("returns isEmpty + 'No mood entries' when input is empty", () => {
    const r = rollupMoodWeek([]);
    expect(r.isEmpty).toBe(true);
    expect(r.totalEntries).toBe(0);
    expect(r.headline).toMatch(/No mood entries/);
    expect(r.greenShare).toBe(0);
  });

  it("counts green/yellow/red and computes shares", () => {
    const r = rollupMoodWeek([
      { zone: "green", atIso: "2026-05-04T09:00:00Z" },
      { zone: "green", atIso: "2026-05-04T11:00:00Z" },
      { zone: "yellow", atIso: "2026-05-05T13:00:00Z" },
      { zone: "red", atIso: "2026-05-06T14:00:00Z" },
    ]);
    expect(r.green).toBe(2);
    expect(r.yellow).toBe(1);
    expect(r.red).toBe(1);
    expect(r.totalEntries).toBe(4);
    expect(r.greenShare).toBeCloseTo(0.5);
    expect(r.yellowShare).toBeCloseTo(0.25);
    expect(r.redShare).toBeCloseTo(0.25);
  });

  it("counts distinct YYYY-MM-DD days", () => {
    const r = rollupMoodWeek([
      { zone: "green", atIso: "2026-05-04T09:00:00Z" },
      { zone: "green", atIso: "2026-05-04T15:00:00Z" },
      { zone: "yellow", atIso: "2026-05-05T13:00:00Z" },
    ]);
    expect(r.coveredDays).toBe(2);
  });

  it("ignores invalid zones and malformed entries", () => {
    const r = rollupMoodWeek([
      { zone: "green", atIso: "2026-05-04T09:00:00Z" },
      { zone: "bad-zone" as any, atIso: "2026-05-04T11:00:00Z" },
      null as any,
      { zone: "" as any },
      undefined as any,
      { zone: "RED", atIso: "2026-05-04T11:00:00Z" }, // case-insensitive accepted
    ]);
    expect(r.totalEntries).toBe(2);
    expect(r.green).toBe(1);
    expect(r.red).toBe(1);
  });

  it("ignores malformed atIso for day count, but still counts the entry", () => {
    const r = rollupMoodWeek([
      { zone: "green", atIso: "garbage" },
      { zone: "green", atIso: "2026-05-04T09:00:00Z" },
    ]);
    expect(r.totalEntries).toBe(2);
    expect(r.coveredDays).toBe(1);
  });

  it("headline is week-framed, never kid-framed", () => {
    const cases = [
      [{ zone: "red" as const, atIso: "2026-05-04" }],
      [{ zone: "green" as const, atIso: "2026-05-04" }],
      [{ zone: "yellow" as const, atIso: "2026-05-04" }],
    ];
    for (const c of cases) {
      const r = rollupMoodWeek(c);
      expect(r.headline.toLowerCase()).not.toMatch(/reagan|she|her/);
    }
  });

  it("Tough-week headline triggers at red ≥40%", () => {
    const r = rollupMoodWeek([
      { zone: "red", atIso: "2026-05-04" },
      { zone: "red", atIso: "2026-05-05" },
      { zone: "green", atIso: "2026-05-06" },
      { zone: "yellow", atIso: "2026-05-07" },
      { zone: "green", atIso: "2026-05-08" },
    ]);
    expect(r.headline).toMatch(/Tough week/);
  });

  it("Bumpy-week headline triggers at red ≥20% but <40%", () => {
    const r = rollupMoodWeek([
      { zone: "red", atIso: "2026-05-04" },
      { zone: "green", atIso: "2026-05-05" },
      { zone: "green", atIso: "2026-05-06" },
      { zone: "green", atIso: "2026-05-07" },
      { zone: "yellow", atIso: "2026-05-08" },
    ]);
    expect(r.headline).toMatch(/Bumpy week/);
  });

  it("Strong-week headline at green ≥70%", () => {
    const r = rollupMoodWeek([
      { zone: "green", atIso: "2026-05-04" },
      { zone: "green", atIso: "2026-05-05" },
      { zone: "green", atIso: "2026-05-06" },
      { zone: "green", atIso: "2026-05-07" },
      { zone: "yellow", atIso: "2026-05-08" },
    ]);
    expect(r.headline).toMatch(/Strong week/);
  });

  it("Steady-week headline at green 50-69%", () => {
    const r = rollupMoodWeek([
      { zone: "green", atIso: "2026-05-04" },
      { zone: "green", atIso: "2026-05-05" },
      { zone: "green", atIso: "2026-05-06" },
      { zone: "yellow", atIso: "2026-05-07" },
      { zone: "yellow", atIso: "2026-05-08" },
    ]);
    expect(r.headline).toMatch(/Steady week/);
  });

  it("Mixed-week headline when green<50% and red<20%", () => {
    const r = rollupMoodWeek([
      { zone: "yellow", atIso: "2026-05-04" },
      { zone: "yellow", atIso: "2026-05-05" },
      { zone: "yellow", atIso: "2026-05-06" },
      { zone: "yellow", atIso: "2026-05-07" },
      { zone: "green", atIso: "2026-05-08" },
    ]);
    expect(r.headline).toMatch(/Mixed week/);
  });

  it("Light-week headline when only one calendar day is covered", () => {
    const r = rollupMoodWeek([
      { zone: "green", atIso: "2026-05-04T09:00:00Z" },
      { zone: "green", atIso: "2026-05-04T15:00:00Z" },
    ]);
    expect(r.headline).toMatch(/Light week/);
    expect(r.coveredDays).toBe(1);
  });

  it("non-array input returns isEmpty cleanly", () => {
    const r = rollupMoodWeek(undefined as any);
    expect(r.isEmpty).toBe(true);
    expect(r.totalEntries).toBe(0);
  });
});
