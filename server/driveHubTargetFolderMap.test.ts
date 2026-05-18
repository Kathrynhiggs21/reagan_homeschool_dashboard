/**
 * Drive Hub target-folder map lock — 2026-05-18 (v2.49).
 *
 * Snapshots the full DrivePushTarget -> CanonicalParentSlug -> leaf-folder mapping
 * so any future change to either layer must explicitly update this test. Without
 * this lock, a renamed enum value or a renamed Drive top-level folder could
 * silently misroute the 8 PM agenda email packet, the per-block worksheets, or
 * the notebook camera uploads.
 *
 * If this test fails:
 *   1. Was the change intentional? If yes, update the snapshot below.
 *   2. Did you also rename the matching Drive top-level folder
 *      (01 - Daily Operations, etc.) and update app_settings['drive.folder.<slug>']?
 *   3. Run scripts/drive_hub_simplify_2026_05_18.py --apply if folders need to move.
 */
import { describe, expect, it } from "vitest";
import {
  DRIVE_FOLDER_NAMES,
  DRIVE_TARGET_TO_CANONICAL_PARENT,
  type CanonicalParentSlug,
  type DrivePushTarget,
} from "./db";

const EXPECTED_TARGETS: DrivePushTarget[] = [
  "reagan",
  "reagan_ihes",
  "reagan_tutor",
  "reagan_artwork",
  "reagan_assignments",
  "finished_work",
  "daily_schedule",
  "worksheets",
  "printables",
  "report_cards",
  "journal",
  "analytics",
  "adult_notes",
  "kiwi_coins",
  "tutor",
  "apps_tools",
  "bookshelf",
  "adventures",
  "practice",
  "notebook",
  "curriculum_checklist",
  "day_log",
  "recap_reply",
  "topics_covered",
  "agenda_pdf",
];

const EXPECTED_PARENTS: CanonicalParentSlug[] = [
  "adminAndHomeschoolRecords",
  "adventuresAndEnrichment",
  "assignmentsAndWork",
  "curriculumAndStandards",
  "dailyOperations",
  "inboxUnsorted",
  "printablesAndResources",
  "progressAndReports",
  "todo",
];

// Top-level Drive folder names AFTER the 2026-05-18 simplification. Keep in
// sync with scripts/drive_hub_simplify_2026_05_18.py and the audit doc.
const EXPECTED_HUB_TOP_LEVEL_FOLDERS = [
  "01 - Daily Operations",
  "02 - Assignments and Work",
  "03 - Curriculum and Resources",
  "04 - Admin and Records",
  "05 - Progress and Reports",
  "06 - Inbox (Unsorted)",
  "Archive",
];

// Each canonical parent slug resolves to one of the 6 numbered top-level folders
// (or to none — `todo` is dashboard-internal and `adventuresAndEnrichment` nests
// inside Curriculum and Resources).
const EXPECTED_PARENT_TO_HUB_FOLDER: Record<CanonicalParentSlug, string | null> = {
  adminAndHomeschoolRecords: "04 - Admin and Records",
  adventuresAndEnrichment: "03 - Curriculum and Resources",
  assignmentsAndWork: "02 - Assignments and Work",
  curriculumAndStandards: "03 - Curriculum and Resources",
  dailyOperations: "01 - Daily Operations",
  inboxUnsorted: "06 - Inbox (Unsorted)",
  printablesAndResources: "03 - Curriculum and Resources",
  progressAndReports: "05 - Progress and Reports",
  todo: null,
};

describe("Drive Hub target folder map lock (v2.49)", () => {
  it("DrivePushTarget enum lists exactly the 25 expected values", () => {
    const actual = Object.keys(DRIVE_FOLDER_NAMES).sort();
    expect(actual).toEqual([...EXPECTED_TARGETS].sort());
  });

  it("Every DrivePushTarget has a leaf-folder name", () => {
    for (const t of EXPECTED_TARGETS) {
      expect(DRIVE_FOLDER_NAMES[t], `target ${t} is missing a leaf name`).toBeDefined();
      // The catch-all "reagan" intentionally has empty string (writes to Hub root).
      if (t !== "reagan") {
        expect(DRIVE_FOLDER_NAMES[t].length, `target ${t} leaf name is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("Every DrivePushTarget resolves to a CanonicalParentSlug", () => {
    for (const t of EXPECTED_TARGETS) {
      const slug = DRIVE_TARGET_TO_CANONICAL_PARENT[t];
      expect(slug, `target ${t} has no canonical parent`).toBeDefined();
      expect(EXPECTED_PARENTS).toContain(slug);
    }
  });

  it("Every CanonicalParentSlug is reachable from at least one DrivePushTarget (except 'todo')", () => {
    const reachable = new Set<CanonicalParentSlug>();
    for (const t of EXPECTED_TARGETS) {
      reachable.add(DRIVE_TARGET_TO_CANONICAL_PARENT[t]);
    }
    for (const slug of EXPECTED_PARENTS) {
      if (slug === "todo") continue; // dashboard-internal, never a Drive write target
      expect(reachable.has(slug), `canonical parent ${slug} has no DrivePushTarget`).toBe(true);
    }
  });

  it("Every CanonicalParentSlug maps to one of the 6 numbered Hub folders (or nothing for 'todo')", () => {
    for (const slug of EXPECTED_PARENTS) {
      const hubFolder = EXPECTED_PARENT_TO_HUB_FOLDER[slug];
      if (slug === "todo") {
        expect(hubFolder).toBeNull();
        continue;
      }
      expect(hubFolder, `${slug} has no Hub top-level folder mapping`).toBeTruthy();
      expect(EXPECTED_HUB_TOP_LEVEL_FOLDERS).toContain(hubFolder!);
    }
  });

  it("8 PM email-critical targets resolve correctly: agenda_pdf -> dailyOperations -> 01 - Daily Operations", () => {
    expect(DRIVE_TARGET_TO_CANONICAL_PARENT.agenda_pdf).toBe("dailyOperations");
    expect(DRIVE_FOLDER_NAMES.agenda_pdf).toBe("Daily Agenda PDFs");
    expect(EXPECTED_PARENT_TO_HUB_FOLDER.dailyOperations).toBe("01 - Daily Operations");
  });

  it("Per-block worksheet target resolves correctly: worksheets -> assignmentsAndWork -> 02 - Assignments and Work", () => {
    expect(DRIVE_TARGET_TO_CANONICAL_PARENT.worksheets).toBe("assignmentsAndWork");
    expect(DRIVE_FOLDER_NAMES.worksheets).toBe("Worksheets (Daily Packets)");
    expect(EXPECTED_PARENT_TO_HUB_FOLDER.assignmentsAndWork).toBe("02 - Assignments and Work");
  });

  it("Notebook attachments target resolves correctly: notebook -> adminAndHomeschoolRecords -> 04 - Admin and Records", () => {
    expect(DRIVE_TARGET_TO_CANONICAL_PARENT.notebook).toBe("adminAndHomeschoolRecords");
    expect(DRIVE_FOLDER_NAMES.notebook).toBe("Notebook");
    expect(EXPECTED_PARENT_TO_HUB_FOLDER.adminAndHomeschoolRecords).toBe("04 - Admin and Records");
  });
});
