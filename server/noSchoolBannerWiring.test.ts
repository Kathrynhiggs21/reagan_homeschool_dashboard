/**
 * v2.23 (2026-05-17) — NoSchoolBanner is mounted on Today.tsx.
 *
 * The forward planner now skips IH off-days (v2.22). To make that visible
 * to Reagan, Today.tsx renders a small banner that reads from
 * `schoolCalendar.list` and shows the day's label (e.g. "Labor Day") with
 * "No school today — go play, rest, or invent something cozy" below it.
 *
 * This is a source-pattern wiring test (no DOM render): it locks the
 * structural contract so a future refactor can't silently lose the banner
 * or its data source without tripping a red test.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const BANNER_FILE = path.join(ROOT, "client/src/components/NoSchoolBanner.tsx");
const TODAY_FILE = path.join(ROOT, "client/src/pages/Today.tsx");

function read(p: string) {
  return fs.readFileSync(p, "utf8");
}

describe("v2.23 — NoSchoolBanner is wired into Today.tsx", () => {
  it("the NoSchoolBanner component file exists", () => {
    expect(fs.existsSync(BANNER_FILE)).toBe(true);
  });

  it("the banner reads from `schoolCalendar.list` (re-uses Schedule.tsx's cache)", () => {
    const src = read(BANNER_FILE);
    expect(src).toMatch(/trpc\.schoolCalendar\.list\.useQuery/);
  });

  it("the banner is a no-op (returns null) when there is no off-day for today", () => {
    const src = read(BANNER_FILE);
    // Either an early-return null when offRow is falsy, OR an explicit
    // `if (!offRow) return null;` pattern.
    expect(src).toMatch(/if\s*\(\s*!offRow\s*\)\s*return\s+null\s*;/);
  });

  it("the banner normalizes Drizzle's Date object before string compare", () => {
    const src = read(BANNER_FILE);
    // Lock the Drizzle-Date-vs-string fix so it doesn't silently regress.
    expect(src).toMatch(/instanceof Date/);
    expect(src).toMatch(/slice\(0,\s*10\)/);
  });

  it("the banner exposes `data-testid=\"no-school-banner\"` for future browser tests", () => {
    const src = read(BANNER_FILE);
    expect(src).toMatch(/data-testid="no-school-banner"/);
  });

  it("the banner uses role=status / aria-live=polite for accessibility", () => {
    const src = read(BANNER_FILE);
    expect(src).toMatch(/role="status"/);
    expect(src).toMatch(/aria-live="polite"/);
  });

  it("the banner falls back to a generic label when the calendar row has none", () => {
    const src = read(BANNER_FILE);
    // Lock the `offRow.label || "No school today"` fallback so an empty
    // label can't render as a blank header.
    expect(src).toMatch(/offRow\.label\s*\|\|\s*"No school today"/);
  });

  it("Today.tsx imports NoSchoolBanner", () => {
    const src = read(TODAY_FILE);
    expect(src).toMatch(/from "@\/components\/NoSchoolBanner"/);
  });

  it("Today.tsx mounts <NoSchoolBanner ... />", () => {
    const src = read(TODAY_FILE);
    expect(src).toMatch(/<NoSchoolBanner[\s/>]/);
  });

  it("the banner mount is positioned ABOVE the TutorOfDayStrip so it is the first signal of the page on a no-school day", () => {
    const src = read(TODAY_FILE);
    const bannerIdx = src.indexOf("<NoSchoolBanner");
    const tutorIdx = src.indexOf("<TutorOfDayStrip");
    expect(bannerIdx).toBeGreaterThan(0);
    expect(tutorIdx).toBeGreaterThan(0);
    expect(bannerIdx).toBeLessThan(tutorIdx);
  });
});
