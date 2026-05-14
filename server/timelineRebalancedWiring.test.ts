/**
 * Push 147 (2026-05-14) — today.timelineRebalanced wiring contract.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "routers.ts"), "utf8");

describe("today.timelineRebalanced", () => {
  it("declares the procedure", () => {
    expect(src).toContain("timelineRebalanced: publicProcedure");
  });

  it("imports the pure helper", () => {
    expect(src).toMatch(/import\(\s*"\.\/_lib\/dayTimelineRebalancer"\s*\)/);
    expect(src).toContain("rebalanceDayTimeline");
  });

  it("validates HH:mm shapes for actualStart + hardEnd", () => {
    expect(src).toMatch(/actualStartHHmm: z\.string\(\)\.regex\(\/\^\(\[01\]/);
    expect(src).toMatch(/hardEndHHmm: z\.string\(\)\.regex\(\/\^\(\[01\]/);
  });

  it("accepts the block shape the helper expects", () => {
    expect(src).toContain("blockSortOrder: z.number().int().min(1).max(40)");
    expect(src).toContain('moodAdjustment: z\n                .enum(["none", "shorten_next", "swap_to_movement", "end_block_now"])');
  });

  it("supports per-block locked flag (tutor windows shouldn't move)", () => {
    expect(src).toContain("locked: z.boolean().optional()");
  });
});
