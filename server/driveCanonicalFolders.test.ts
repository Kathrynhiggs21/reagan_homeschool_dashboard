import { describe, it, expect } from "vitest";
import { getAppSetting } from "./db";

/**
 * Canonical Drive hub folder map — established 2026-05-12 under
 * spear.cpt@gmail.com. These ids must be reachable at runtime so the
 * worker never silently creates duplicate top-level folders.
 */
const EXPECTED_FOLDERS: Record<string, string> = {
  "drive.rootFolderId": "1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r",
  "drive.rootFolderOwner": "spear.cpt@gmail.com",
  "drive.folder.adminAndHomeschoolRecords": "1RcO_WCr2mG2v_4cVxHjslx4UpsFflHan",
  "drive.folder.adventuresAndEnrichment": "1i1-UtUYady8BcWJzozXpf_igQEoY_loa",
  "drive.folder.assignmentsAndWork": "1--Z75dZRcTTrEVlRGtIVfP5b1OMi8hCT",
  "drive.folder.curriculumAndStandards": "18HhQdVn6F-IS6eZOV41xRbST5cHGuqJM",
  "drive.folder.dailyOperations": "1wyFk4rTPT-bZsadEVwODmqnABhevn6yb",
  "drive.folder.inboxUnsorted": "1PQPK34gnnlZrNojxFLJddCnDSpUQ5kR1",
  "drive.folder.printablesAndResources": "1MpQ0OGDBvloSz_DzCGa8pUYytSjOuHWw",
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
