/**
 * getCanonicalSubfolderId reads back what the worker wrote into
 * app_settings['drive.folderMap.<parent>.<sub>'] and returns null if
 * the worker hasn't yet reported a given (parent, subfolder) pair.
 *
 * Round-trip uses the same slugify() rules as the /api/scheduled/drive-folder-map/result endpoint.
 */
import { describe, it, expect } from "vitest";
import { setAppSetting, getCanonicalSubfolderId } from "./db";

describe("getCanonicalSubfolderId — round-trip with worker-stored ids", () => {
  it("returns null when no entry has been stored yet", async () => {
    const result = await getCanonicalSubfolderId("Daily Operations", `__never_resolved_${Date.now()}__`);
    expect(result).toBeNull();
  });

  it("returns the stored Drive folder id after the worker reports it", async () => {
    const fakeId = `1FAKE_subfolder_${Date.now()}`;
    // Match the worker's /result slugify rules exactly: [^A-Za-z0-9] → _
    await setAppSetting("drive.folderMap.Daily_Operations.Day_Logs", fakeId);
    const result = await getCanonicalSubfolderId("Daily Operations", "Day Logs");
    expect(result).toBe(fakeId);
  });

  it("slugifies parent + subfolder names with non-alphanumeric chars (parens, hyphens, ampersands)", async () => {
    const fakeId = `1FAKE_inbox_${Date.now()}`;
    // "Inbox (Unsorted)" + "Drop new things here — nightly classifier sweeps"
    // Slugify regex `[^A-Za-z0-9]+` collapses RUNS of non-alphanum to a single _, so:
    //   "Inbox (Unsorted)" -> "Inbox_Unsorted_"
    //   "Drop new things here — nightly classifier sweeps" -> "Drop_new_things_here_nightly_classifier_sweeps"
    await setAppSetting("drive.folderMap.Inbox_Unsorted_.Drop_new_things_here_nightly_classifier_sweeps", fakeId);
    const result = await getCanonicalSubfolderId("Inbox (Unsorted)", "Drop new things here — nightly classifier sweeps");
    expect(result).toBe(fakeId);
  });
});
