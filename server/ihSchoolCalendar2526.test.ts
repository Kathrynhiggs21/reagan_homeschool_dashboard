/**
 * v2.17 (2026-05-17) — IH 2025-26 calendar dataset + seeder wiring tests.
 *
 * Two layers:
 *   1. Pure-data assertions on `IH_2025_26_OFF_DAYS`: shape, sort,
 *      uniqueness, every well-known holiday is present, and the date
 *      window matches the official PDF.
 *   2. Source-pattern wiring assertions on routers.ts: the new
 *      `schoolCalendar.seedIH2526` procedure is gated by
 *      `familyAdminProcedure` and reads from the canonical dataset
 *      module (no inline duplication).
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  IH_2025_26_OFF_DAYS,
  filterIH2526Window,
} from "./_lib/ihSchoolCalendar2526";

const ROUTERS_PATH = path.resolve(__dirname, "..", "server/routers.ts");

describe("v2.17 — IH 2025-26 calendar dataset", () => {
  it("dataset is non-empty", () => {
    expect(IH_2025_26_OFF_DAYS.length).toBeGreaterThan(20);
  });

  it("every row uses YYYY-MM-DD format", () => {
    for (const r of IH_2025_26_OFF_DAYS) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("every row marks isOff=true and uses the canonical source", () => {
    for (const r of IH_2025_26_OFF_DAYS) {
      expect(r.isOff).toBe(true);
      expect(r.source).toBe("Indian Hill 2025-26");
      expect(r.label.length).toBeGreaterThan(0);
    }
  });

  it("dates are sorted chronologically and unique", () => {
    const dates = IH_2025_26_OFF_DAYS.map((r) => r.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("date window covers the 2025-2026 school year", () => {
    const dates = IH_2025_26_OFF_DAYS.map((r) => r.date);
    expect(dates[0] >= "2025-08-01").toBe(true);
    expect(dates[dates.length - 1] <= "2026-06-30").toBe(true);
  });

  it("includes well-known holidays the planner must skip", () => {
    const dates = new Set(IH_2025_26_OFF_DAYS.map((r) => r.date));
    // Anchor dates from the official IH PDF (Updated June 25, 2025).
    expect(dates.has("2025-09-01")).toBe(true); // Labor Day
    expect(dates.has("2025-11-26")).toBe(true); // Thanksgiving Break
    expect(dates.has("2025-12-25")).toBe(true); // Winter Break (Christmas)
    expect(dates.has("2026-01-01")).toBe(true); // Winter Break (New Year)
    expect(dates.has("2026-01-19")).toBe(true); // MLK Day
    expect(dates.has("2026-02-16")).toBe(true); // Presidents' Day
    expect(dates.has("2026-03-30")).toBe(true); // Spring Break starts
    expect(dates.has("2026-04-06")).toBe(true); // Spring Break ends
  });

  it("filterIH2526Window respects inclusive [from, to] bounds", () => {
    const window = filterIH2526Window(IH_2025_26_OFF_DAYS, "2025-12-01", "2026-01-31");
    expect(window.length).toBeGreaterThan(0);
    for (const r of window) {
      expect(r.date >= "2025-12-01").toBe(true);
      expect(r.date <= "2026-01-31").toBe(true);
    }
    // Sanity: at least all 8 winter-break days + Jan 5 PD + Jan 19 MLK = 10.
    expect(window.length).toBeGreaterThanOrEqual(10);
  });

  it("filterIH2526Window with no bounds returns the full dataset", () => {
    const all = filterIH2526Window(IH_2025_26_OFF_DAYS);
    expect(all.length).toBe(IH_2025_26_OFF_DAYS.length);
  });
});

describe("v2.17 — schoolCalendar.seedIH2526 wiring", () => {
  it("routers.ts exposes seedIH2526 gated by familyAdminProcedure", () => {
    const src = fs.readFileSync(ROUTERS_PATH, "utf8");
    expect(src).toMatch(/seedIH2526:\s*familyAdminProcedure/);
  });

  it("seedIH2526 imports from the canonical _lib/ihSchoolCalendar2526 module", () => {
    const src = fs.readFileSync(ROUTERS_PATH, "utf8");
    // Accept either a static `from "./_lib/ihSchoolCalendar2526"` or the
    // dynamic `await import("./_lib/ihSchoolCalendar2526")` we use today
    // (so we can keep tree-shaking the dataset out of the cold-start path).
    expect(src).toMatch(/["']\.\/_lib\/ihSchoolCalendar2526["']/);
    expect(src).toMatch(/IH_2025_26_OFF_DAYS/);
  });

  it("seedIH2526 returns inserted/skipped counts (idempotent contract)", () => {
    const src = fs.readFileSync(ROUTERS_PATH, "utf8");
    // Contract: response shape includes attempted/inserted/skipped.
    expect(src).toMatch(/attempted:/);
    expect(src).toMatch(/inserted,/);
    expect(src).toMatch(/skipped,/);
  });

  it("seedIH2526 short-circuits already-off dates instead of throwing on UNIQUE", () => {
    const src = fs.readFileSync(ROUTERS_PATH, "utf8");
    // Must check db.isSchoolOff before inserting, else the date column's
    // UNIQUE constraint would surface as a 500 to Mom.
    expect(src).toMatch(/db\.isSchoolOff\(row\.date\)/);
  });
});
