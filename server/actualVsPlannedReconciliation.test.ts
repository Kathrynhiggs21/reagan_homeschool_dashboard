/**
 * Push 68 (2026-05-13) — Slice 4.5 actual-vs-planned reconciliation.
 *
 * The actual-vs-planned infrastructure shipped in earlier passes
 * (todayCoverageWithActuals, ActualVsPlannedForDate, off-plan capture
 * in recapEntry/offPlanTopics — see also actualVsPlanned.test.ts which
 * locks per-block chip rendering). This contract locks the bigger
 * Mom-facing invariants for the Today % path that we don't want to
 * silently lose during refactors:
 *
 *   1. effectivePct is capped at 100 — off-plan actuals never push
 *      planned subjects past 100% on Today.
 *   2. Off-plan rows are tagged offPlan: true with effectivePct: 100
 *      so the Today badge can color them differently.
 *   3. Off-plan rows preserve actualEntries + actualMinutes so the
 *      Grandma-recap path can write them to Drive even on a summer day.
 *   4. recapEntry persists offPlanTopics so the next-morning Drive
 *      sync sees them.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DB = readFileSync(join(__dirname, "db.ts"), "utf8");

describe("Slice 4.5 reconciliation — invariants", () => {
  it("todayCoverageWithActuals export still exists", () => {
    expect(DB).toMatch(/export async function todayCoverageWithActuals\b/);
  });

  it("effectivePct is capped at 100 (Math.min(p.total, p.done + a.entries))", () => {
    expect(DB).toMatch(/Math\.min\(p\.total,\s*p\.done\s*\+\s*a\.entries\)/);
  });

  it("off-plan rows are tagged offPlan: true with effectivePct: 100 when entries > 0", () => {
    expect(DB).toMatch(/effectivePct:\s*a\.entries\s*>\s*0\s*\?\s*100\s*:\s*0/);
    expect(DB).toMatch(/offPlan:\s*true/);
  });

  it("off-plan rows preserve actualEntries + actualMinutes for Grandma recap", () => {
    const offPlanBlock = DB.split("Off-plan subjects (have actuals, no planned blocks)")[1] || "";
    expect(offPlanBlock).toMatch(/actualEntries:\s*a\.entries/);
    expect(offPlanBlock).toMatch(/actualMinutes:\s*a\.minutes/);
  });

  it("recapEntry persists offPlanTopics so Drive sync sees them next morning", () => {
    expect(DB).toMatch(/offPlanTopics:/);
  });

  it("ActualVsPlannedForDate type exposes offPlanActuals", () => {
    expect(DB).toMatch(/offPlanActuals:/);
  });
});
