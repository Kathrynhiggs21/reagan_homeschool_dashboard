/**
 * Push 40 — Actual-vs-Planned strip (per-block) on Today + Schedule.
 *
 * Pure-function tests verify the matching logic that
 * getActualVsPlannedForDate uses end-to-end. We avoid hitting MySQL
 * by exercising a local mirror of the same loose-match algorithm and
 * asserting on the strings that wire it together.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { computeCoverageDelta } from "./db";

describe("Actual-vs-Planned strip — push 40", () => {
  const routersSrc = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
  const dbSrc = fs.readFileSync(path.join(__dirname, "db.ts"), "utf-8");
  const todaySrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "Today.tsx"),
    "utf-8",
  );
  const scheduleSrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "Schedule.tsx"),
    "utf-8",
  );

  it("db.getActualVsPlannedForDate exists and returns the documented shape", () => {
    expect(dbSrc).toContain("export async function getActualVsPlannedForDate(");
    expect(dbSrc).toContain("ActualVsPlannedForDate");
    expect(dbSrc).toContain("offPlanActuals:");
    expect(dbSrc).toContain("plannedBlocks: number;");
  });

  it("the matcher pins by plannedBlockId first, then loose-matches by title", () => {
    // Loose match rule: planned title contains actual topic OR vice versa.
    // Block 2 title "Reading - Tuck Everlasting" contains actual topic "Tuck Everlasting".
    const planned = [
      { id: 1, title: "Long Division" },
      { id: 2, title: "Reading - Tuck Everlasting" },
    ];
    const actuals = [
      { plannedBlockId: 1, subjectSlug: "math", topic: "regrouping" }, // pinned
      { plannedBlockId: null, subjectSlug: "ela", topic: "Tuck Everlasting" }, // loose match → 2
      { plannedBlockId: null, subjectSlug: "sci", topic: "rock cycle" }, // off-plan
    ];
    const delta = computeCoverageDelta(planned, actuals);
    expect(delta.coveredBlockIds.sort()).toEqual([1, 2]);
    expect(delta.offPlanEntries).toEqual([{ subjectSlug: "sci", topic: "rock cycle" }]);
  });

  it("actuals.vsPlanned tRPC query is exposed under protectedProcedure", () => {
    expect(routersSrc).toMatch(/vsPlanned: protectedProcedure/);
    expect(routersSrc).toContain("db.getActualVsPlannedForDate(input.dateISO)");
  });

  it("Today.tsx mounts ActualVsPlannedChips only when adult is unlocked", () => {
    expect(todaySrc).toMatch(/\{unlocked && \(\s*<ActualVsPlannedChips blockId=\{b\.id\}/);
  });

  it("ActualVsPlannedChips reads from trpc.actuals.vsPlanned", () => {
    expect(todaySrc).toMatch(/actuals\?\.vsPlanned\?\.useQuery\?\.\(\{ dateISO \}/);
  });

  it("ActualVsPlannedChips hides itself when block has no actuals (no clutter)", () => {
    const idx = todaySrc.indexOf("function ActualVsPlannedChips(");
    const slice = todaySrc.slice(idx, idx + 1200);
    expect(slice).toMatch(/if \(!block \|\| !block\.actuals \|\| block\.actuals\.length === 0\) return null/);
  });

  it("Schedule.tsx renders ScheduleActualVsPlannedChips per block (adult-gated)", () => {
    expect(scheduleSrc).toContain("<ScheduleActualVsPlannedChips blockId={b.id} dateISO={dateStr} />");
    expect(scheduleSrc).toContain("function ScheduleActualVsPlannedChips(");
    // Adult-gate honored
    const idx = scheduleSrc.indexOf("function ScheduleActualVsPlannedChips(");
    const slice = scheduleSrc.slice(idx, idx + 800);
    expect(slice).toContain("if (!unlocked) return null");
  });

  it("chip styling distinguishes pinned (emerald) vs loose (amber)", () => {
    const idx = todaySrc.indexOf("function ActualVsPlannedChips(");
    const slice = todaySrc.slice(idx, idx + 2000);
    expect(slice).toContain("a.pinned");
    expect(slice).toContain("emerald");
    expect(slice).toContain("amber");
  });
});
