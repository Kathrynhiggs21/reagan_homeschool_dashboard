import { describe, it, expect } from "vitest";
import {
  DRIVE_FOLDER_NAMES,
  DRIVE_TARGET_TO_CANONICAL_PARENT,
  getCanonicalParentForRoutable,
} from "./db";

const VALID_PARENTS = new Set([
  "adminAndHomeschoolRecords",
  "adventuresAndEnrichment",
  "assignmentsAndWork",
  "curriculumAndStandards",
  "dailyOperations",
  "inboxUnsorted",
  "printablesAndResources",
  "progressAndReports",
  "todo",
]);

describe("DRIVE_TARGET_TO_CANONICAL_PARENT — every routable target is anchored under one of the 9 canonical folders", () => {
  it("covers every key in DRIVE_FOLDER_NAMES (no orphans, no extras)", () => {
    const folderKeys = Object.keys(DRIVE_FOLDER_NAMES).sort();
    const parentKeys = Object.keys(DRIVE_TARGET_TO_CANONICAL_PARENT).sort();
    expect(parentKeys).toEqual(folderKeys);
  });

  it("every parent value is one of the 9 canonical slugs", () => {
    for (const [target, parent] of Object.entries(DRIVE_TARGET_TO_CANONICAL_PARENT)) {
      expect(
        VALID_PARENTS.has(parent),
        `target ${target} maps to invalid parent slug ${parent}`,
      ).toBe(true);
    }
  });

  it("getCanonicalParentForRoutable returns the persisted folder id from app_settings", async () => {
    const r = await getCanonicalParentForRoutable("worksheets");
    expect(r.slug).toBe("assignmentsAndWork");
    expect(r.folderId).toBe("1--Z75dZRcTTrEVlRGtIVfP5b1OMi8hCT"); // canonical id seeded 2026-05-12
  });

  it("catch-all 'reagan' target lands in Inbox (Unsorted), not at hub root", async () => {
    const r = await getCanonicalParentForRoutable("reagan");
    expect(r.slug).toBe("inboxUnsorted");
    expect(r.folderId).toBe("1PQPK34gnnlZrNojxFLJddCnDSpUQ5kR1");
  });

  it("daily-schedule lands in Daily Operations", async () => {
    const r = await getCanonicalParentForRoutable("daily_schedule");
    expect(r.slug).toBe("dailyOperations");
    expect(r.folderId).toBe("1wyFk4rTPT-bZsadEVwODmqnABhevn6yb");
  });

  it("report cards + analytics + apps_tools + kiwi_coins all land in Progress and Reports", async () => {
    for (const t of ["report_cards", "analytics", "apps_tools", "kiwi_coins"] as const) {
      const r = await getCanonicalParentForRoutable(t);
      expect(r.slug, `${t} should be progressAndReports`).toBe("progressAndReports");
    }
  });
});
