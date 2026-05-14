/**
 * Overnight push 2026-05-14 — self-rebalancing day timeline contract.
 */
import { describe, it, expect } from "vitest";
import { rebalanceDayTimeline, type PlannedBlock } from "./_lib/dayTimelineRebalancer";

const baseDay: PlannedBlock[] = [
  { blockSortOrder: 1, blockTitle: "Math", subjectName: "Math", scheduledMinutes: 30 },
  { blockSortOrder: 2, blockTitle: "Reading", subjectName: "Reading", scheduledMinutes: 30 },
  { blockSortOrder: 3, blockTitle: "Science", subjectName: "Science", scheduledMinutes: 30 },
];

describe("rebalanceDayTimeline", () => {
  it("places blocks back-to-back from the actual start time", () => {
    const r = rebalanceDayTimeline(baseDay, {
      actualStartHHmm: "09:35",
      hardEndHHmm: "15:30",
    });
    expect(r.blocks.map((b) => b.startHHmm)).toEqual(["09:35", "10:05", "10:35"]);
    expect(r.blocks.map((b) => b.endHHmm)).toEqual(["10:05", "10:35", "11:05"]);
    expect(r.notes).toEqual([]);
  });

  it("shortens the next block when previous block flagged shorten_next", () => {
    const day: PlannedBlock[] = [
      { ...baseDay[0], moodAdjustment: "shorten_next" },
      baseDay[1],
      baseDay[2],
    ];
    const r = rebalanceDayTimeline(day, {
      actualStartHHmm: "09:00",
      hardEndHHmm: "15:30",
    });
    // 30 -> 23 (round 22.5), so block #2 = 23 min
    expect(r.blocks[1].durationMinutes).toBe(23);
    expect(r.notes[0]).toContain("Reading is 7 min shorter");
  });

  it("inserts a movement break after a swap_to_movement adjustment", () => {
    const day: PlannedBlock[] = [
      { ...baseDay[0], moodAdjustment: "swap_to_movement" },
      baseDay[1],
      baseDay[2],
    ];
    const r = rebalanceDayTimeline(day, {
      actualStartHHmm: "09:00",
      hardEndHHmm: "15:30",
      movementMinutes: 5,
    });
    expect(r.blocks).toHaveLength(4);
    expect(r.blocks[1].insertedByRebalancer).toBe(true);
    expect(r.blocks[1].blockTitle).toBe("Stretch / Outside Break");
    expect(r.blocks[1].durationMinutes).toBe(5);
    expect(r.notes[0]).toContain("stretch break");
  });

  it("uses actualMinutes for completed blocks instead of scheduled", () => {
    const day: PlannedBlock[] = [
      { ...baseDay[0], status: "done", actualMinutes: 45 },
      baseDay[1],
    ];
    const r = rebalanceDayTimeline(day, {
      actualStartHHmm: "09:00",
      hardEndHHmm: "15:30",
    });
    expect(r.blocks[0].durationMinutes).toBe(45);
    expect(r.blocks[1].startHHmm).toBe("09:45");
  });

  it("clamps blocks to min/max bounds (non-locked only)", () => {
    const day: PlannedBlock[] = [
      { blockSortOrder: 1, blockTitle: "Math", scheduledMinutes: 200 },
      { blockSortOrder: 2, blockTitle: "Tiny", scheduledMinutes: 1 },
    ];
    const r = rebalanceDayTimeline(day, {
      actualStartHHmm: "09:00",
      hardEndHHmm: "15:30",
      minBlockMinutes: 10,
      maxBlockMinutes: 60,
    });
    expect(r.blocks[0].durationMinutes).toBe(60);
    expect(r.blocks[1].durationMinutes).toBe(10);
  });

  it("does not clamp locked blocks", () => {
    const day: PlannedBlock[] = [
      { blockSortOrder: 1, blockTitle: "Tutor", scheduledMinutes: 90, locked: true },
    ];
    const r = rebalanceDayTimeline(day, {
      actualStartHHmm: "09:00",
      hardEndHHmm: "15:30",
      maxBlockMinutes: 60,
    });
    expect(r.blocks[0].durationMinutes).toBe(90);
  });

  it("flags blocks that spill past hardEndHHmm", () => {
    const day: PlannedBlock[] = Array.from({ length: 8 }, (_, i) => ({
      blockSortOrder: i + 1,
      blockTitle: `B${i + 1}`,
      scheduledMinutes: 60,
    }));
    const r = rebalanceDayTimeline(day, {
      actualStartHHmm: "13:00",
      hardEndHHmm: "15:30",
    });
    const spilled = r.blocks.filter((b) => b.spilledPastEnd);
    expect(spilled.length).toBeGreaterThan(0);
    expect(r.notes.some((n) => n.includes("past 15:30"))).toBe(true);
  });

  it("respects sortOrder even if input is shuffled", () => {
    const r = rebalanceDayTimeline([baseDay[2], baseDay[0], baseDay[1]], {
      actualStartHHmm: "09:00",
      hardEndHHmm: "15:30",
    });
    expect(r.blocks.map((b) => b.blockTitle)).toEqual([
      "Math",
      "Reading",
      "Science",
    ]);
  });
});
