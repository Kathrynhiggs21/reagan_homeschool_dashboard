/**
 * Push 153 (2026-05-14) — analyticsEmptyStateGuard vitest contract.
 */
import { describe, it, expect } from "vitest";
import { guardAnalyticsStrip } from "./_lib/analyticsEmptyStateGuard";

const empty = {
  blocksDone: 0,
  blocksPlanned: 0,
  minutesOnTask: 0,
  submissionsGraded: 0,
  currentStreakDays: 0,
  subjectsTouched: 0,
};

describe("guardAnalyticsStrip", () => {
  it("hides the strip when all metrics are zero", () => {
    const r = guardAnalyticsStrip(empty);
    expect(r.stripVisible).toBe(false);
    expect(r.tiles).toHaveLength(0);
    expect(r.emptyStateMessage).toMatch(/No school activity yet today/);
  });

  it("shows blocks_done when blocksPlanned > 0 even if 0 done yet", () => {
    const r = guardAnalyticsStrip({ ...empty, blocksPlanned: 5 });
    expect(r.stripVisible).toBe(true);
    expect(r.tiles[0].key).toBe("blocks_done");
    expect(r.tiles[0].value).toBe(0);
    expect(r.tiles[0].label).toMatch(/of 5 blocks done/);
  });

  it("shows minutes_on_task only when > 0", () => {
    const r = guardAnalyticsStrip({ ...empty, minutesOnTask: 17 });
    expect(r.tiles.some((t) => t.key === "minutes_on_task")).toBe(true);
  });

  it("hides minutes_on_task when 0", () => {
    const r = guardAnalyticsStrip({ ...empty, blocksPlanned: 5 });
    expect(r.tiles.some((t) => t.key === "minutes_on_task")).toBe(false);
  });

  it("shows submissions_graded only when > 0", () => {
    const r = guardAnalyticsStrip({ ...empty, submissionsGraded: 3 });
    expect(r.tiles.some((t) => t.key === "submissions_graded")).toBe(true);
  });

  it("uses singular 'day in a row' for streak=1", () => {
    const r = guardAnalyticsStrip({ ...empty, currentStreakDays: 1, blocksDone: 1 });
    const streakTile = r.tiles.find((t) => t.key === "current_streak_days");
    expect(streakTile?.label).toBe("day in a row");
  });

  it("uses plural 'days in a row' for streak=5", () => {
    const r = guardAnalyticsStrip({ ...empty, currentStreakDays: 5, blocksDone: 1 });
    const streakTile = r.tiles.find((t) => t.key === "current_streak_days");
    expect(streakTile?.label).toBe("days in a row");
  });

  it("orders tiles consistently", () => {
    const r = guardAnalyticsStrip({
      blocksDone: 2,
      blocksPlanned: 5,
      minutesOnTask: 30,
      submissionsGraded: 1,
      currentStreakDays: 4,
      subjectsTouched: 3,
    });
    expect(r.tiles.map((t) => t.key)).toEqual([
      "blocks_done",
      "minutes_on_task",
      "submissions_graded",
      "subjects_touched",
      "current_streak_days",
    ]);
  });

  it("strip becomes visible the moment ANY metric is positive", () => {
    const r = guardAnalyticsStrip({ ...empty, currentStreakDays: 1 });
    expect(r.stripVisible).toBe(true);
    expect(r.emptyStateMessage).toBeNull();
  });

  it("returns kid-readable empty-state message (no jargon)", () => {
    const r = guardAnalyticsStrip(empty);
    expect(r.emptyStateMessage).not.toMatch(/aggregate|tile|stripVisible/);
  });
});
