import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * v2.42 (2026-05-18) — The kid /schedule page MUST be a real Reagan-friendly
 * weekly view (not a redundant copy of Today). This test locks the contract.
 */

const ROOT = resolve(__dirname, "..");
const SCHEDULE = resolve(ROOT, "client/src/pages/Schedule.tsx");
const APP = resolve(ROOT, "client/src/App.tsx");
const DOCK = resolve(ROOT, "client/src/components/OrbDock.tsx");

function read(p: string) {
  return readFileSync(p, "utf-8");
}

describe("v2.42 — kid /schedule weekly view", () => {
  it("Schedule.tsx exists", () => {
    expect(existsSync(SCHEDULE)).toBe(true);
  });

  it("offers Day / Week / Month tabs and defaults to Week", () => {
    const src = read(SCHEDULE);
    expect(src).toMatch(/\["day", "week", "month"\] as View\[\]/);
    expect(src).toMatch(/useState<View>\(\s*"week"\s*\)/);
  });

  it("renders the WeekView mounting point", () => {
    const src = read(SCHEDULE);
    expect(src).toMatch(/<WeekView\b/);
  });

  it("shows IH off-day shading from schoolCalendar.list", () => {
    const src = read(SCHEDULE);
    expect(src).toMatch(/trpc\.schoolCalendar\.list\.useQuery/);
    expect(src).toMatch(/isOff/);
  });

  it("includes a friendly summer-break countdown banner", () => {
    const src = read(SCHEDULE);
    expect(src).toMatch(/until summer break/);
  });

  it("opens an Agenda dialog per day (read-only for Reagan)", () => {
    const src = read(SCHEDULE);
    expect(src).toMatch(/<AgendaDialog/);
    expect(src).toMatch(/onOpenAgenda/);
  });

  it("links back to Today for the calmer single-day kid view", () => {
    const src = read(SCHEDULE);
    expect(src).toMatch(/navigate\("\/today"\)/);
  });

  it("mounts ActivityOptionsPanel under the Week view (kid choice options)", () => {
    const src = read(SCHEDULE);
    expect(src).toMatch(/<ActivityOptionsPanel\s*\/>/);
  });

  it("App.tsx mounts /schedule route", () => {
    const src = read(APP);
    expect(src).toMatch(/path="\/schedule"/);
  });

  it("OrbDock still has a /schedule orb (nav reachability)", () => {
    const src = read(DOCK);
    expect(src).toMatch(/KID_ORBS[\s\S]{0,2000}\/schedule/);
  });

  it("forward-plan card stays adult-only (gated by useAdultLock unlocked)", () => {
    const src = read(SCHEDULE);
    expect(src).toMatch(/useAdultLock\(\)/);
    expect(src).toMatch(/\{unlocked && <TodayForwardPlanCard/);
  });
});
