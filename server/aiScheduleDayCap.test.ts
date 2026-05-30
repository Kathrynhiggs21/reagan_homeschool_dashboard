/**
 * 2026-05-30 — Day cap on AI schedule output.
 *
 * sanitizeBlocks must enforce: max 10 blocks, max 300 minutes (5 hours).
 * Anything beyond gets dropped with a warning, so a runaway LLM that
 * tries to emit 16 blocks can't slip past validation.
 */
import { describe, it, expect } from "vitest";
import { sanitizeBlocks } from "./_lib/aiScheduleGenerator";

const validSlugs = new Set(["math", "ela", "science", "history"]);

function makeRaw(n: number, durationMin = 30) {
  return Array.from({ length: n }, (_, i) => ({
    blockType: "math",
    title: `Block ${i + 1}`,
    description: `Test block ${i + 1}`,
    durationMin,
    startTime: "09:00",
    subjectSlug: "math",
    curriculumTopicCode: null,
  }));
}

describe("sanitizeBlocks day cap", () => {
  it("keeps all blocks when under both caps (8 blocks × 30 min = 240 min)", () => {
    const { blocks, warnings } = sanitizeBlocks(makeRaw(8, 30), validSlugs);
    expect(blocks).toHaveLength(8);
    expect(warnings.filter((w) => w.includes("day cap"))).toHaveLength(0);
  });

  it("caps at 10 blocks even when the LLM emits more", () => {
    const { blocks, warnings } = sanitizeBlocks(makeRaw(16, 20), validSlugs);
    expect(blocks).toHaveLength(10);
    expect(warnings.some((w) => /day cap of 10 blocks reached/.test(w))).toBe(true);
  });

  it("caps at 300 minutes even when count is under the block cap", () => {
    // 7 blocks × 50 min = 350 min — block 7 should be dropped at the 5h ceiling.
    const { blocks, warnings } = sanitizeBlocks(makeRaw(7, 50), validSlugs);
    expect(blocks.reduce((s, b) => s + b.durationMin, 0)).toBeLessThanOrEqual(300);
    expect(warnings.some((w) => /day cap of 300 min/.test(w))).toBe(true);
  });

  it("respects both caps together — 16 × 30 min runs into the 300-min cap first (10 blocks = 300 min)", () => {
    const { blocks } = sanitizeBlocks(makeRaw(16, 30), validSlugs);
    expect(blocks.reduce((s, b) => s + b.durationMin, 0)).toBeLessThanOrEqual(300);
    expect(blocks.length).toBeLessThanOrEqual(10);
  });

  it("still returns blocks when input is empty (no warnings about caps)", () => {
    const { blocks, warnings } = sanitizeBlocks([], validSlugs);
    expect(blocks).toHaveLength(0);
    expect(warnings.some((w) => /day cap/.test(w))).toBe(false);
  });

  it("warns when a full day has fewer than 4 blocks (thin-day advisory)", () => {
    const { blocks, warnings } = sanitizeBlocks(makeRaw(2, 30), validSlugs, undefined, "full");
    expect(blocks).toHaveLength(2);
    expect(warnings.some((w) => /thin day .* at least 4/.test(w))).toBe(true);
  });

  it("warns when a full day totals less than 120 minutes", () => {
    // 4 blocks × 25 min = 100 min — just under the 2h floor.
    const { warnings } = sanitizeBlocks(makeRaw(4, 25), validSlugs, undefined, "full");
    expect(warnings.some((w) => /thin day .* at least 120 min/.test(w))).toBe(true);
  });

  it("does NOT warn about thin days when dayLength is 'half' or 'off'", () => {
    const half = sanitizeBlocks(makeRaw(2, 30), validSlugs, undefined, "half");
    expect(half.warnings.some((w) => /thin day/.test(w))).toBe(false);
    const off = sanitizeBlocks(makeRaw(0), validSlugs, undefined, "off");
    expect(off.warnings.some((w) => /thin day/.test(w))).toBe(false);
  });
});
