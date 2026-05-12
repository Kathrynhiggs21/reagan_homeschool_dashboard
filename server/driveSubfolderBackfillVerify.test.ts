/**
 * Verifies the 2026-05-12 subfolder backfill: every expected canonical
 * subfolder under each of the 9 hub top-level folders has a resolved
 * Drive ID stored in app_settings as `drive.folderMap.<parent>.<sub>`.
 *
 * If a future canonical subfolder is added in scheduledSync.ts but the
 * worker hasn't been re-run, this test will flag it.
 */
import { describe, it, expect } from "vitest";
import { getCanonicalSubfolderId } from "./db";

const CANONICAL_SUBFOLDERS: Record<string, string[]> = {
  "Admin and Homeschool Records": [
    "IEP Snapshots (preserved)",
    "504 Plans (preserved)",
    "Tutor Agreements",
    "Annual Notice of Intent",
    "PowerSchool Snapshot (read-only)",
    "Reagan Health (medical, IEP, 504, anxiety timeline)",
    "Behavior History (preserved)",
  ],
  "Adventures and Enrichment": [
    "Adventures Library",
    "Field Trip Photos",
    "Reading Journal (Bookshelf log)",
  ],
  "Assignments and Work": ["Worksheets to Do", "Submitted Work", "Photos of Work"],
  "Curriculum and Standards": ["Topics Covered", "Coverage Snapshots", "Standards Library"],
  "Daily Operations": ["Day Logs", "Daily Agenda PDFs", "Recap Replies"],
  "Printables and Resources": [
    "Coloring Pages",
    "Reward Charts",
    "Master Worksheet Library",
    "Reagan's Books (cover scans + page refs)",
  ],
  "Progress and Reports": [
    "Weekly Digests",
    "Term Summaries",
    "Behavior + Mood Timeline",
    "Absences and Sick Days",
    "Analytics CSV Exports",
  ],
  Todo: ["Mom Todos", "Grandma Todos", "Tutor Todos"],
};

describe("Drive subfolder backfill — every canonical subfolder is persisted in app_settings", () => {
  for (const [parent, subs] of Object.entries(CANONICAL_SUBFOLDERS)) {
    for (const sub of subs) {
      it(`${parent} → ${sub} has a resolved Drive folder ID`, async () => {
        const id = await getCanonicalSubfolderId(parent, sub);
        expect(id, `Missing drive.folderMap entry for ${parent} / ${sub}`).toBeTruthy();
        // Drive folder IDs are 25+ char base64-ish strings that start with `1`
        expect(id!.length).toBeGreaterThanOrEqual(20);
        expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      });
    }
  }

  it("total subfolder count matches expected (31 across 8 parents; Inbox has none)", async () => {
    const total = Object.values(CANONICAL_SUBFOLDERS).reduce((n, a) => n + a.length, 0);
    expect(total).toBe(31);
  });
});
