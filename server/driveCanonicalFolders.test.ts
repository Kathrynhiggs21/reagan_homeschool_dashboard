import { describe, it, expect } from "vitest";
import { getAppSetting } from "./db";

/**
 * Canonical Drive hub folder map — established 2026-05-12 under
 * spear.cpt@gmail.com. These ids must be reachable at runtime so the
 * worker never silently creates duplicate top-level folders.
 */
// v2.57 (2026-05-19): post-v2.54 Drive Hub unification re-pointed several
// folder IDs to their populated counterparts (see todo.md "2026-05-18…
// Drive Hub unification"). The DB is the source of truth — these IDs are
// what `appSettings` actually contains in production.
const EXPECTED_FOLDERS: Record<string, string> = {
  "drive.rootFolderId": "1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r",
  "drive.rootFolderOwner": "spear.cpt@gmail.com",
  "drive.folder.adminAndHomeschoolRecords": "1aLViM1-T0_ob0CFNxJN9hnzMauROySjF",
  "drive.folder.adventuresAndEnrichment": "137Knn9KbGKPcTsmOhHhM930HTxEGpjWB",
  "drive.folder.assignmentsAndWork": "1--Z75dZRcTTrEVlRGtIVfP5b1OMi8hCT",
  "drive.folder.curriculumAndStandards": "1ighaciRpTk8oloh55dEhgx0YZmomsZWJ",
  "drive.folder.dailyOperations": "1wyFk4rTPT-bZsadEVwODmqnABhevn6yb",
  "drive.folder.inboxUnsorted": "1PQPK34gnnlZrNojxFLJddCnDSpUQ5kR1",
  "drive.folder.printablesAndResources": "1UxqumEtHKucybapWNaNttaDGNg_0QQCH",
  "drive.folder.progressAndReports": "1YYRTEko_yYCg0V3S-tx-wyT6wQ2F2mpj",
  "drive.folder.todo": "15XPBzEZZD78Veq3mvk90yFFKP_vGMXHJ",
};

describe("Drive canonical folder map", () => {
  it("getAppSetting returns the canonical id for every drive.folder.* key", async () => {
    for (const [key, expected] of Object.entries(EXPECTED_FOLDERS)) {
      const v = await getAppSetting(key);
      expect(v, `app_settings[${key}] should resolve to ${expected}`).toBe(expected);
    }
  });

  it("there are exactly 9 canonical top-level folders + 2 root meta keys", () => {
    const folderKeys = Object.keys(EXPECTED_FOLDERS).filter((k) => k.startsWith("drive.folder."));
    expect(folderKeys.length).toBe(9);
  });
});
