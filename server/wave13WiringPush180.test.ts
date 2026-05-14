import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Push 180 (Wave-14) — wiring contract: today.notebookDoodleToday and
 * today.bookshelfMilestoneToday must exist on the today router.
 */
describe("Push 180 — Wave-14 wiring", () => {
  const src = readFileSync(
    join(__dirname, "routers.ts"),
    "utf8",
  );

  it("declares today.notebookDoodleToday wired to pickNotebookDoodlePrompt", () => {
    expect(src).toMatch(/notebookDoodleToday\s*:\s*publicProcedure/);
    expect(src).toMatch(/pickNotebookDoodlePrompt/);
    expect(src).toMatch(/_lib\/notebookDoodlePrompt/);
  });

  it("declares today.bookshelfMilestoneToday wired to computeBookshelfMilestone", () => {
    expect(src).toMatch(/bookshelfMilestoneToday\s*:\s*publicProcedure/);
    expect(src).toMatch(/computeBookshelfMilestone/);
    expect(src).toMatch(/_lib\/bookshelfMilestoneCelebration/);
  });

  it("both are part of the today router section (after multiDayMoodTrend)", () => {
    const trendIdx = src.indexOf("multiDayMoodTrend");
    const doodleIdx = src.indexOf("notebookDoodleToday");
    const shelfIdx = src.indexOf("bookshelfMilestoneToday");
    expect(trendIdx).toBeGreaterThan(0);
    expect(doodleIdx).toBeGreaterThan(trendIdx);
    expect(shelfIdx).toBeGreaterThan(trendIdx);
  });
});
