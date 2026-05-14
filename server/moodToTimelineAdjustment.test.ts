/**
 * Push 150 (2026-05-14) — moodToTimelineAdjustment vitest contract.
 */
import { describe, it, expect } from "vitest";
import { applyMoodToTimelineBlocks, type RebalancerBlockInput } from "./_lib/moodToTimelineAdjustment";

const baseBlocks: RebalancerBlockInput[] = [
  { blockSortOrder: 1, blockTitle: "Math", subjectName: "Math", scheduledMinutes: 30, status: "done" },
  { blockSortOrder: 2, blockTitle: "Reading", subjectName: "Reading", scheduledMinutes: 25, status: "in_progress" },
  { blockSortOrder: 3, blockTitle: "Science", subjectName: "Science", scheduledMinutes: 30 },
];

describe("applyMoodToTimelineBlocks", () => {
  it("no-op + no clone when reading suggests 'none'", () => {
    const r = applyMoodToTimelineBlocks(
      baseBlocks,
      { suggestedAdjustment: "none" },
      { activeBlockSortOrder: 2 },
    );
    expect(r.changed).toBe(false);
    expect(r.blocks).toBe(baseBlocks); // identity preserved
  });

  it("sets shorten_next on the active block", () => {
    const r = applyMoodToTimelineBlocks(
      baseBlocks,
      { suggestedAdjustment: "shorten_next" },
      { activeBlockSortOrder: 2 },
    );
    expect(r.changed).toBe(true);
    expect(r.blocks).not.toBe(baseBlocks); // immutable copy
    expect(r.blocks[1].moodAdjustment).toBe("shorten_next");
    expect(r.blocks[0].moodAdjustment).toBeUndefined();
    expect(r.blocks[2].moodAdjustment).toBeUndefined();
    expect(r.reason).toMatch(/dragging/);
  });

  it("sets swap_to_movement when Kiwi suggests a stretch break", () => {
    const r = applyMoodToTimelineBlocks(
      baseBlocks,
      { suggestedAdjustment: "swap_to_movement" },
      { activeBlockSortOrder: 2 },
    );
    expect(r.changed).toBe(true);
    expect(r.blocks[1].moodAdjustment).toBe("swap_to_movement");
    expect(r.reason).toMatch(/stretch break/);
  });

  it("sets end_block_now on frustration", () => {
    const r = applyMoodToTimelineBlocks(
      baseBlocks,
      { suggestedAdjustment: "end_block_now" },
      { activeBlockSortOrder: 2 },
    );
    expect(r.changed).toBe(true);
    expect(r.blocks[1].moodAdjustment).toBe("end_block_now");
    expect(r.reason).toMatch(/frustrated/i);
  });

  it("returns unchanged when active sortOrder isn't in the list", () => {
    const r = applyMoodToTimelineBlocks(
      baseBlocks,
      { suggestedAdjustment: "shorten_next" },
      { activeBlockSortOrder: 99 },
    );
    expect(r.changed).toBe(false);
    expect(r.blocks).toBe(baseBlocks);
    expect(r.reason).toMatch(/couldn't match/);
  });

  it("never overrides a locked block", () => {
    const blocks: RebalancerBlockInput[] = [
      ...baseBlocks.slice(0, 1),
      { ...baseBlocks[1], locked: true },
      ...baseBlocks.slice(2),
    ];
    const r = applyMoodToTimelineBlocks(
      blocks,
      { suggestedAdjustment: "shorten_next" },
      { activeBlockSortOrder: 2 },
    );
    expect(r.changed).toBe(false);
    expect(r.reason).toMatch(/Mom locked/);
  });

  it("respects overrideExisting=false when an adjustment is already set", () => {
    const blocks: RebalancerBlockInput[] = [
      ...baseBlocks.slice(0, 1),
      { ...baseBlocks[1], moodAdjustment: "swap_to_movement" },
      ...baseBlocks.slice(2),
    ];
    const r = applyMoodToTimelineBlocks(
      blocks,
      { suggestedAdjustment: "shorten_next" },
      { activeBlockSortOrder: 2, overrideExisting: false },
    );
    expect(r.changed).toBe(false);
    expect(r.blocks[1].moodAdjustment).toBe("swap_to_movement");
  });

  it("default behavior overrides an existing adjustment (latest mood wins)", () => {
    const blocks: RebalancerBlockInput[] = [
      ...baseBlocks.slice(0, 1),
      { ...baseBlocks[1], moodAdjustment: "swap_to_movement" },
      ...baseBlocks.slice(2),
    ];
    const r = applyMoodToTimelineBlocks(
      blocks,
      { suggestedAdjustment: "end_block_now" },
      { activeBlockSortOrder: 2 },
    );
    expect(r.changed).toBe(true);
    expect(r.blocks[1].moodAdjustment).toBe("end_block_now");
  });

  it("no-op when the requested adjustment already matches", () => {
    const blocks: RebalancerBlockInput[] = [
      ...baseBlocks.slice(0, 1),
      { ...baseBlocks[1], moodAdjustment: "shorten_next" },
      ...baseBlocks.slice(2),
    ];
    const r = applyMoodToTimelineBlocks(
      blocks,
      { suggestedAdjustment: "shorten_next" },
      { activeBlockSortOrder: 2 },
    );
    expect(r.changed).toBe(false);
    expect(r.blocks[1].moodAdjustment).toBe("shorten_next");
  });

  it("kid-readable reason strings (no internal jargon)", () => {
    for (const adj of ["shorten_next", "swap_to_movement", "end_block_now"] as const) {
      const r = applyMoodToTimelineBlocks(
        baseBlocks,
        { suggestedAdjustment: adj },
        { activeBlockSortOrder: 2 },
      );
      expect(r.reason).not.toMatch(/sortOrder|moodAdjustment|suggestedAdjustment/);
    }
  });
});
