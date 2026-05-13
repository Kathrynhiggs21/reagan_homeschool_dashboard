/**
 * Push 30 — agenda tagging guard.
 *
 * Locks in the contract that NO academic agenda block produced by
 * the AI generator can land in scheduleBlocks without a curriculum
 * topic code. Three layers of defense are tested:
 *   1. sanitizeBlocks emits a warning when an academic block has no
 *      topic code AND a non-empty catalog was supplied.
 *   2. sanitizeBlocks strips topic codes that aren't in the catalog
 *      so the commit step always re-prompts for a real one.
 *   3. Non-academic blocks (adventure, appointment) DO NOT need a
 *      code and never trigger the warning.
 *
 * Closes the spec line:
 *   "Vitest guard: agendaTagging.test.ts asserts no agenda item
 *    without a curriculumTopicId can land in scheduleBlocks via
 *    the AI generator"
 */
import { describe, it, expect } from "vitest";
import { sanitizeBlocks } from "./_lib/aiScheduleGenerator";

describe("agenda tagging guard — push 30", () => {
  const validSlugs = new Set(["math", "ela", "science"]);
  const validTopicCodes = new Set(["5.OA.1", "5.G.2", "RL.5.2"]);

  it("warns when an academic block (math) has no topic code", () => {
    const { blocks, warnings } = sanitizeBlocks(
      [
        { blockType: "math", title: "Order of operations", durationMin: 30 },
      ],
      validSlugs,
      validTopicCodes,
    );
    expect(blocks.length).toBe(1);
    expect(blocks[0].curriculumTopicCode).toBe(null);
    expect(warnings.some((w) => /missing curriculumTopicCode/i.test(w))).toBe(true);
  });

  it("warns for every academic block type", () => {
    const academicTypes = ["morning_warmup", "math", "read_aloud", "choice", "catch_up", "custom"];
    for (const t of academicTypes) {
      const { warnings } = sanitizeBlocks(
        [{ blockType: t, title: "x", durationMin: 30 }],
        validSlugs,
        validTopicCodes,
      );
      expect(
        warnings.some((w) => /missing curriculumTopicCode/i.test(w)),
        `expected warning for ${t}`,
      ).toBe(true);
    }
  });

  it("does NOT warn for non-academic blocks (adventure, appointment)", () => {
    for (const t of ["adventure", "appointment"]) {
      const { warnings } = sanitizeBlocks(
        [{ blockType: t, title: "x", durationMin: 30 }],
        validSlugs,
        validTopicCodes,
      );
      expect(warnings.some((w) => /missing curriculumTopicCode/i.test(w))).toBe(false);
    }
  });

  it("strips topic codes that aren't in the catalog (commit step re-prompts)", () => {
    const { blocks, warnings } = sanitizeBlocks(
      [
        { blockType: "math", title: "x", durationMin: 30, curriculumTopicCode: "MADE.UP.99" },
      ],
      validSlugs,
      validTopicCodes,
    );
    expect(blocks[0].curriculumTopicCode).toBe(null);
    expect(warnings.some((w) => /not in catalog/i.test(w))).toBe(true);
  });

  it("preserves topic codes that ARE in the catalog", () => {
    const { blocks } = sanitizeBlocks(
      [
        { blockType: "math", title: "x", durationMin: 30, curriculumTopicCode: "5.OA.1" },
      ],
      validSlugs,
      validTopicCodes,
    );
    expect(blocks[0].curriculumTopicCode).toBe("5.OA.1");
  });

  it("does NOT emit the missing-code warning when no catalog was supplied (offline / unit-test mode)", () => {
    const { warnings } = sanitizeBlocks(
      [
        { blockType: "math", title: "x", durationMin: 30 },
      ],
      validSlugs,
      // no validTopicCodes argument
    );
    expect(warnings.some((w) => /missing curriculumTopicCode/i.test(w))).toBe(false);
  });
});
