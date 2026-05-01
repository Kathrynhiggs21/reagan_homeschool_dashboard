import { describe, it, expect } from "vitest";
import {
  sanitizeBlocks,
  buildPromptMessages,
  ALLOWED_BLOCK_TYPES,
} from "./_lib/aiScheduleGenerator";

describe("aiScheduleGenerator.sanitizeBlocks", () => {
  const valid = new Set(["math", "ela", "science"]);

  it("accepts a fully-formed block and normalizes startTime + duration", () => {
    const r = sanitizeBlocks(
      [
        { blockType: "math", title: "Angles & circles", description: "Use a paper circle", durationMin: 30, startTime: "9:30", subjectSlug: "math" },
      ],
      valid,
    );
    expect(r.warnings).toHaveLength(0);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].blockType).toBe("math");
    expect(r.blocks[0].startTime).toBe("09:30");
    expect(r.blocks[0].subjectSlug).toBe("math");
  });

  it("drops blocks with invalid blockType but keeps the rest", () => {
    const r = sanitizeBlocks(
      [
        { blockType: "lunch", title: "Lunch break", description: "x", durationMin: 30 },
        { blockType: "morning_warmup", title: "Soft start", description: "stretch", durationMin: 10 },
      ],
      valid,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].title).toBe("Soft start");
    expect(r.warnings.some(w => w.includes("invalid blockType"))).toBe(true);
  });

  it("drops blocks with empty title", () => {
    const r = sanitizeBlocks([{ blockType: "math", title: "  ", description: "x", durationMin: 20 }], valid);
    expect(r.blocks).toHaveLength(0);
    expect(r.warnings.some(w => w.includes("empty title"))).toBe(true);
  });

  it("clamps duration to (0, 180]", () => {
    const r = sanitizeBlocks(
      [
        { blockType: "math", title: "A", description: "x", durationMin: 9999 },
        { blockType: "math", title: "B", description: "x", durationMin: -5 },
        { blockType: "math", title: "C", description: "x", durationMin: "not a number" },
      ],
      valid,
    );
    expect(r.blocks.map(b => b.durationMin)).toEqual([180, 30, 30]);
  });

  it("nulls unknown subjectSlug and warns", () => {
    const r = sanitizeBlocks(
      [{ blockType: "math", title: "T", description: "x", durationMin: 20, subjectSlug: "wizardry" }],
      valid,
    );
    expect(r.blocks[0].subjectSlug).toBeNull();
    expect(r.warnings.some(w => w.includes("wizardry"))).toBe(true);
  });

  it("returns empty + warning when input is not an array", () => {
    const r = sanitizeBlocks({ not: "array" }, valid);
    expect(r.blocks).toHaveLength(0);
    expect(r.warnings).toContain("LLM returned non-array");
  });

  it("ignores null/undefined/non-object rows", () => {
    const r = sanitizeBlocks([null, undefined, 42, "x", { blockType: "math", title: "Keep", description: "x", durationMin: 10 }], valid);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].title).toBe("Keep");
  });

  it("truncates oversized title and description", () => {
    const longTitle = "x".repeat(500);
    const longDesc = "y".repeat(10_000);
    const r = sanitizeBlocks([{ blockType: "math", title: longTitle, description: longDesc, durationMin: 30 }], valid);
    expect(r.blocks[0].title.length).toBeLessThanOrEqual(200);
    expect(r.blocks[0].description.length).toBeLessThanOrEqual(4000);
  });
});

describe("aiScheduleGenerator.buildPromptMessages", () => {
  const baseInput = {
    dateStr: "2026-05-04",
    dayLabel: "Monday, May 4",
    studentName: "Reagan",
    gradeLevel: "5th grade",
    interests: ["birds", "Roblox"],
    whatWorks: ["short blocks", "movement breaks"],
    whatHarms: ["surprise tests"],
    subjects: [
      { slug: "math", name: "Math" },
      { slug: "ela", name: "ELA" },
    ],
    dayLength: "half" as const,
    adultPrompt: "Focus on triangles + planets.",
  };

  it("emits exactly one system + one user message", () => {
    const m = buildPromptMessages(baseInput);
    expect(m).toHaveLength(2);
    expect(m[0].role).toBe("system");
    expect(m[1].role).toBe("user");
  });

  it("system message lists every allowed block type and every subject slug", () => {
    const m = buildPromptMessages(baseInput);
    const sys = m[0].content;
    for (const t of ALLOWED_BLOCK_TYPES) expect(sys).toContain(t);
    expect(sys).toContain("math");
    expect(sys).toContain("ela");
  });

  it("includes parent's adultPrompt in the user message verbatim", () => {
    const m = buildPromptMessages(baseInput);
    expect(m[1].content).toContain("Focus on triangles + planets.");
    expect(m[1].content).toContain("Reagan");
    expect(m[1].content).toContain("Monday, May 4");
  });

  it("hints half-day total minutes when dayLength=half", () => {
    const m = buildPromptMessages(baseInput);
    expect(m[0].content).toMatch(/90.*150 minutes/);
  });

  it("hints rest-only when dayLength=off", () => {
    const m = buildPromptMessages({ ...baseInput, dayLength: "off" });
    expect(m[0].content).toMatch(/one optional rest block/);
  });

  it("does not crash with missing optional fields", () => {
    const m = buildPromptMessages({
      dateStr: "2026-05-05",
      dayLabel: "Tuesday, May 5",
      studentName: "Reagan",
      subjects: [{ slug: "math", name: "Math" }],
    } as any);
    expect(m).toHaveLength(2);
    expect(m[0].content).toContain("Reagan");
  });
});
