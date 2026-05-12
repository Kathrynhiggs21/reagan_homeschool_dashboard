import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * The worker contract for /api/scheduled/drive-folder-map. We assert against
 * the source file (no live HTTP needed) so this test is hermetic and runs
 * everywhere.
 */
describe("/api/scheduled/drive-folder-map — worker contract", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "scheduledSync.ts"),
    "utf8",
  );

  it("registers the GET endpoint", () => {
    expect(src).toContain('app.get("/api/scheduled/drive-folder-map"');
  });

  it("registers the POST result endpoint that caches resolved subfolder ids", () => {
    expect(src).toContain('app.post("/api/scheduled/drive-folder-map/result"');
    expect(src).toContain("drive.folderMap.");
  });

  it("declares all 9 canonical top-level folders in the GET response", () => {
    const required = [
      "Admin and Homeschool Records",
      "Adventures and Enrichment",
      "Assignments and Work",
      "Curriculum and Standards",
      "Daily Operations",
      "Inbox (Unsorted)",
      "Printables and Resources",
      "Progress and Reports",
      "Todo",
    ];
    for (const name of required) {
      expect(src, `top-level folder ${JSON.stringify(name)} should be declared`).toContain(
        `"${name}"`,
      );
    }
  });

  it("declares the canonical subfolders the dashboard syncs into", () => {
    const subfolders = [
      "Day Logs",
      "Daily Agenda PDFs",
      "Recap Replies",
      "Worksheets to Do",
      "Submitted Work",
      "Photos of Work",
      "Topics Covered",
      "Coverage Snapshots",
      "Standards Library",
      "Weekly Digests",
      "Term Summaries",
      "Behavior + Mood Timeline",
      "Absences and Sick Days",
      "Analytics CSV Exports",
      "Adventures Library",
      "Field Trip Photos",
      "Reading Journal (Bookshelf log)",
      "IEP Snapshots (preserved)",
      "504 Plans (preserved)",
      "Tutor Agreements",
      "Annual Notice of Intent",
      "PowerSchool Snapshot (read-only)",
      "Reagan Health (medical, IEP, 504, anxiety timeline)",
      "Behavior History (preserved)",
      "Coloring Pages",
      "Reward Charts",
      "Master Worksheet Library",
      "Reagan's Books (cover scans + page refs)",
      "Mom Todos",
      "Grandma Todos",
      "Tutor Todos",
    ];
    for (const sub of subfolders) {
      expect(src, `subfolder ${sub} should be declared`).toContain(`"${sub}"`);
    }
  });

  it("references the persisted drive.folder.* keys for every top-level id", () => {
    const keys = [
      "drive.folder.adminAndHomeschoolRecords",
      "drive.folder.adventuresAndEnrichment",
      "drive.folder.assignmentsAndWork",
      "drive.folder.curriculumAndStandards",
      "drive.folder.dailyOperations",
      "drive.folder.inboxUnsorted",
      "drive.folder.printablesAndResources",
      "drive.folder.progressAndReports",
      "drive.folder.todo",
    ];
    for (const k of keys) {
      expect(src).toContain(k);
    }
  });

  it("explicitly warns the worker not to recreate the 9 top-level folders", () => {
    expect(src).toContain("MUST NEVER recreate the 9 top-level folders");
  });
});
