/**
 * Push 44 — Kiwi-listened provenance badge.
 *
 * Spec from todo.md:
 *   "Reagan-voice provenance badge in UI: any actual entry with
 *    source='kiwi-listened' shows a tiny mic+Reagan icon so adults
 *    can verify."
 *
 * Surfaces guarded:
 *   1. Today  — ActualVsPlannedChips (per-block chip strip)
 *   2. Today  — TodayQuickEntryCard "Today so far" recent list
 *   3. Schedule day view — ScheduleActualVsPlannedChips
 *
 * The badge is keyed off `source === "kiwi-listened"` exclusively.
 * Manual mom/grandma entries and planned-block-derived rows must not
 * pick up the badge.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Kiwi-listened provenance badge — push 44", () => {
  const todaySrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "Today.tsx"),
    "utf-8",
  );
  const scheduleSrc = fs.readFileSync(
    path.join(__dirname, "..", "client", "src", "pages", "Schedule.tsx"),
    "utf-8",
  );

  function countOccurrences(haystack: string, needle: string): number {
    let count = 0;
    let idx = 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) {
      count += 1;
      idx += needle.length;
    }
    return count;
  }

  it("ActualVsPlannedChips on Today only shows the badge for kiwi-listened actuals", () => {
    const idx = todaySrc.indexOf("ActualVsPlannedChips({ blockId");
    expect(idx).toBeGreaterThan(0);
    const slice = todaySrc.slice(idx, idx + 3000);
    expect(slice).toContain('const fromKiwi = a.source === "kiwi-listened"');
    expect(slice).toContain("{fromKiwi && (");
    expect(slice).toContain('data-testid="kiwi-listened-badge"');
  });

  it("TodayQuickEntryCard recent list also renders the badge", () => {
    const idx = todaySrc.indexOf("today-quick-entry-recent");
    expect(idx).toBeGreaterThan(0);
    const slice = todaySrc.slice(idx, idx + 3000);
    expect(slice).toContain('const fromKiwi = r.source === "kiwi-listened"');
    expect(slice).toContain('data-testid="kiwi-listened-badge"');
  });

  it("Schedule day-view chip strip mirrors the badge", () => {
    const idx = scheduleSrc.indexOf("ScheduleActualVsPlannedChips({ blockId");
    expect(idx).toBeGreaterThan(0);
    const slice = scheduleSrc.slice(idx, idx + 3000);
    expect(slice).toContain('const fromKiwi = a.source === "kiwi-listened"');
    expect(slice).toContain('data-testid="kiwi-listened-badge"');
  });

  it("Badge has accessible label so screen readers announce it", () => {
    expect(todaySrc).toContain('aria-label="Captured by Kiwi listening"');
    expect(scheduleSrc).toContain('aria-label="Captured by Kiwi listening"');
  });

  it("Badge is rendered exactly 3 times across surfaces", () => {
    const todayCount = countOccurrences(todaySrc, 'data-testid="kiwi-listened-badge"');
    const scheduleCount = countOccurrences(scheduleSrc, 'data-testid="kiwi-listened-badge"');
    expect(todayCount).toBe(2);   // chips + recent list
    expect(scheduleCount).toBe(1); // schedule chip
  });

  it("Each badge carries the mic+chick glyph pair so adults can spot it visually", () => {
    expect(todaySrc).toContain("🎙️");
    expect(todaySrc).toContain("🐥");
    expect(scheduleSrc).toContain("🎙️");
    expect(scheduleSrc).toContain("🐥");
  });
});
