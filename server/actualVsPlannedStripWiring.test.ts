/**
 * v2.24 (2026-05-17) — ActualVsPlannedStrip is mounted on Today.tsx.
 *
 * Server-side `actuals.vsPlanned` query and `actuals.quickAdd` mutation
 * have existed since Push 40 but had no UI consumer. This locks the new
 * adult-only strip in place.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const STRIP_FILE = path.join(
  ROOT,
  "client/src/components/ActualVsPlannedStrip.tsx",
);
const TODAY_FILE = path.join(ROOT, "client/src/pages/Today.tsx");
const ROUTERS_FILE = path.join(ROOT, "server/routers.ts");

function read(p: string) {
  return fs.readFileSync(p, "utf8");
}

describe("v2.24 — ActualVsPlannedStrip wired into Today.tsx", () => {
  it("the strip component file exists", () => {
    expect(fs.existsSync(STRIP_FILE)).toBe(true);
  });

  it("the strip reads from `actuals.vsPlanned` (existing Push-40 endpoint)", () => {
    const src = read(STRIP_FILE);
    expect(src).toMatch(/trpc\.actuals\.vsPlanned\.useQuery/);
  });

  it("the strip writes via `actuals.quickAdd` (existing endpoint, familyAdmin-gated)", () => {
    const src = read(STRIP_FILE);
    expect(src).toMatch(/trpc\.actuals\.quickAdd\.useMutation/);
  });

  it("the strip invalidates `actuals.vsPlanned` after a successful quickAdd so the chip flips from \"○\" to \"✓\"", () => {
    const src = read(STRIP_FILE);
    expect(src).toMatch(/utils\.actuals\.vsPlanned\.invalidate/);
  });

  it("the strip pins each quickAdd to the planned block via `plannedBlockId`", () => {
    const src = read(STRIP_FILE);
    expect(src).toMatch(/plannedBlockId:\s*blockId/);
  });

  it("the strip renders distinct visual states for actual-present vs not-logged", () => {
    const src = read(STRIP_FILE);
    // Lock the green/emerald tint for "covered" rows so a future refactor
    // doesn't lose the visual signal.
    expect(src).toMatch(/bg-emerald-50/);
    // And the muted tint for not-yet-logged rows.
    expect(src).toMatch(/bg-muted\/40/);
  });

  it("the strip renders an off-plan section when offPlanActuals are present", () => {
    const src = read(STRIP_FILE);
    expect(src).toMatch(/offPlanActuals/);
    expect(src).toMatch(/Off-plan/);
  });

  it("the strip exposes test-ids for the loading, empty, and error states", () => {
    const src = read(STRIP_FILE);
    expect(src).toMatch(/data-testid="avp-loading"/);
    expect(src).toMatch(/data-testid="avp-empty"/);
    expect(src).toMatch(/data-testid="avp-error"/);
  });

  it("the strip wraps the error state with role=alert for accessibility", () => {
    const src = read(STRIP_FILE);
    expect(src).toMatch(/role="alert"/);
  });

  it("the strip clamps minutesSpent to [1,600] and topic to 240 chars before sending", () => {
    const src = read(STRIP_FILE);
    expect(src).toMatch(/Math\.min\(Math\.max\(Math\.round\(m\),\s*1\),\s*600\)/);
    expect(src).toMatch(/topic\.trim\(\)\.slice\(0,\s*240\)/);
  });

  it("Today.tsx imports ActualVsPlannedStrip", () => {
    const src = read(TODAY_FILE);
    expect(src).toMatch(/from "@\/components\/ActualVsPlannedStrip"/);
  });

  it("Today.tsx mounts <ActualVsPlannedStrip /> under the same `unlocked` adult gate as the existing quick-entry card", () => {
    const src = read(TODAY_FILE);
    // Pattern: `{unlocked && <ActualVsPlannedStrip ...`
    expect(src).toMatch(/\{unlocked\s*&&\s*<ActualVsPlannedStrip/);
  });

  it("the strip mount precedes the TodayAdultQuickEntryCard mount so the at-a-glance chips come first", () => {
    const src = read(TODAY_FILE);
    const stripIdx = src.indexOf("<ActualVsPlannedStrip");
    const cardIdx = src.indexOf("<TodayAdultQuickEntryCard");
    expect(stripIdx).toBeGreaterThan(0);
    expect(cardIdx).toBeGreaterThan(0);
    expect(stripIdx).toBeLessThan(cardIdx);
  });

  it("the existing `actuals.vsPlanned` and `actuals.quickAdd` routes still exist on the server (regression lock)", () => {
    const src = read(ROUTERS_FILE);
    expect(src).toMatch(/vsPlanned:\s*protectedProcedure/);
    expect(src).toMatch(/quickAdd:\s*familyAdminProcedure/);
  });
});
