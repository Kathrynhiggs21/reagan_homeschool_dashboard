/**
 * 2026-06-18 — Drive folder-flattening contract.
 *
 * Katy reported Google Drive folder sprawl: the dashboard used to nest
 * every synced artifact under a {YYYY-MM} month subfolder, even though the
 * filenames already start with the full ISO date. That nesting forced Mom
 * and Grandma to click through a month folder for every file.
 *
 * The fix: all date-named artifacts land DIRECTLY in their canonical folder
 * (day_log, recap_reply, topics_covered, agenda_pdf, worksheets, journal,
 * finished_work), sorted naturally by their dated filename.
 *
 * This test locks that contract at the pure-helper layer so a future edit
 * can't silently re-introduce month subfolders for these targets.
 *
 * NOTE: classroom lifecycle moves (Math - Lab/Graded) and the static
 * Reference/IXL/Khan docs intentionally keep a *structural* subpath — those
 * are NOT month buckets and are out of scope for this contract.
 */
import { describe, it, expect } from "vitest";
import {
  describeOffPlanSync,
  describeDayLogSync,
  describeRecapReplySync,
  describeAgendaPdfSync,
} from "./_lib/driveSyncPaths";
import { dayLogSubpath, dayLogFileName } from "./_lib/dayLogBuilder";

const MONTH_RE = /^\d{4}-\d{2}$/;

describe("Drive flattening — no {YYYY-MM} subfolders for date-named artifacts", () => {
  const dates = ["2026-01-05", "2026-06-18", "2026-12-31"];

  it("describeOffPlanSync never returns a month subpath", () => {
    for (const d of dates) {
      const desc = describeOffPlanSync(d, "science", "Water Cycle");
      expect(desc.targetSubpath).toBe("");
      expect(desc.targetSubpath).not.toMatch(MONTH_RE);
      // filename still carries the full date so it sorts/uniquifies in a flat folder
      expect(desc.fileName.startsWith(d)).toBe(true);
    }
  });

  it("describeDayLogSync never returns a month subpath", () => {
    for (const d of dates) {
      const desc = describeDayLogSync(d);
      expect(desc.targetSubpath).toBe("");
      expect(desc.targetSubpath).not.toMatch(MONTH_RE);
      expect(desc.fileName.startsWith(d)).toBe(true);
    }
  });

  it("describeRecapReplySync never returns a month subpath", () => {
    for (const d of dates) {
      const desc = describeRecapReplySync(d, "Grandma Marcy");
      expect(desc.targetSubpath).toBe("");
      expect(desc.targetSubpath).not.toMatch(MONTH_RE);
      expect(desc.fileName.startsWith(d)).toBe(true);
    }
  });

  it("describeAgendaPdfSync never returns a month subpath", () => {
    for (const d of dates) {
      const desc = describeAgendaPdfSync(d);
      expect(desc.targetSubpath).toBe("");
      expect(desc.targetSubpath).not.toMatch(MONTH_RE);
      expect(desc.fileName.startsWith(d)).toBe(true);
    }
  });

  it("dayLogSubpath is flattened to empty for every date", () => {
    for (const d of dates) {
      expect(dayLogSubpath(d)).toBe("");
      expect(dayLogSubpath(d)).not.toMatch(MONTH_RE);
      // filename still date-prefixed
      expect(dayLogFileName(d).startsWith(d)).toBe(true);
    }
  });
});
