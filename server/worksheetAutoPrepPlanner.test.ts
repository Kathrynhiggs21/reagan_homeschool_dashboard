/**
 * Overnight push 2026-05-14 — worksheet auto-prep planner contract.
 */
import { describe, it, expect } from "vitest";
import {
  planWorksheetAutoPrep,
  type PlannedBlockForPrep,
} from "./_lib/worksheetAutoPrepPlanner";

const day: PlannedBlockForPrep[] = [
  { blockId: 1, blockTitle: "Place Value Practice", subjectSlug: "math", subjectName: "Math" },
  { blockId: 2, blockTitle: "Read Tuck Everlasting pg 12-18", subjectName: "Reading" },
  { blockId: 3, blockTitle: "Outdoor Bird Watching", subjectName: "Science" },
  { blockId: 4, blockTitle: "Snack Break", subjectName: "Break" },
  { blockId: 5, blockTitle: "Specials: Art", subjectName: "Art" },
  { blockId: 6, blockTitle: "Spectrum Science Quiz", subjectSlug: "science", subjectName: "Science" },
  { blockId: 7, blockTitle: "ELA Practice", subjectSlug: "ela", subjectName: "ELA", hasAnswerKey: true },
  { blockId: 8, blockTitle: "Mystery Block" },
];

describe("planWorksheetAutoPrep", () => {
  const r = planWorksheetAutoPrep(day);

  it("emits a work item per academic block needing one", () => {
    expect(r.workItems.map((w) => w.blockId).sort()).toEqual([1, 6]);
  });

  it("skips reading-only / movement / break / specials / has-key / missing-subject", () => {
    const reasonsByBlock = Object.fromEntries(
      r.skipped.map((s) => [s.blockId, s.reason]),
    );
    expect(reasonsByBlock[2]).toBe("reading_only");
    expect(reasonsByBlock[3]).toBe("movement");
    expect(reasonsByBlock[4]).toBe("break");
    expect(reasonsByBlock[5]).toBe("specials");
    expect(reasonsByBlock[7]).toBe("already_has_answer_key");
    expect(reasonsByBlock[8]).toBe("missing_subject");
  });

  it("uses subject-specific defaults for question count + points", () => {
    const math = r.workItems.find((w) => w.blockId === 1)!;
    expect(math.expectedQuestions).toBe(8);
    expect(math.totalPoints).toBe(100);
    const science = r.workItems.find((w) => w.blockId === 6)!;
    expect(science.expectedQuestions).toBe(6);
  });

  it("includes block title + curriculum code in the LLM prompt", () => {
    const r2 = planWorksheetAutoPrep([
      {
        blockId: 9,
        blockTitle: "Decimals",
        subjectSlug: "math",
        subjectName: "Math",
        curriculumTopicCode: "M.5.NBT.A.3",
        details: "Compare two decimals to thousandths.",
      },
    ]);
    expect(r2.workItems[0].prompt).toContain("Decimals");
    expect(r2.workItems[0].prompt).toContain("M.5.NBT.A.3");
    expect(r2.workItems[0].prompt).toContain("Compare two decimals");
    expect(r2.workItems[0].prompt).toContain("Make exactly 8 questions");
  });

  it("makes friendlyLabel readable for filenames + email body", () => {
    const math = r.workItems.find((w) => w.blockId === 1)!;
    expect(math.friendlyLabel).toBe("Math - Place Value Practice");
  });

  it("handles an empty day cleanly", () => {
    const r2 = planWorksheetAutoPrep([]);
    expect(r2.workItems).toEqual([]);
    expect(r2.skipped).toEqual([]);
  });
});
