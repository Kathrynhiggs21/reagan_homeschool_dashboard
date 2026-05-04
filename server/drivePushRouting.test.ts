import { describe, it, expect } from "vitest";
import { pickDriveFolderForRouted, DRIVE_FOLDER_NAMES } from "./db";

const file = (overrides: Partial<any> = {}) => ({
  kind: "file" as const,
  fileUrl: "u",
  fileName: "x.png",
  mimeType: "image/png",
  ...overrides,
});

const routed = (label: string, routedTo: any = "timelineEvent") =>
  ({ kind: "file", routedTo, recordId: 1, routedToLabel: label, routedToHref: "/x", message: "" }) as any;

describe("Drive Hub routing — Mom asked May 4 2026", () => {
  it("maps every new sidebar section label to a dedicated folder", () => {
    expect(pickDriveFolderForRouted(routed("Tutor session log"), file())).toBe("tutor");
    expect(pickDriveFolderForRouted(routed("Apps & Tools snapshot"), file())).toBe("apps_tools");
    expect(pickDriveFolderForRouted(routed("Bookshelf reading log"), file())).toBe("bookshelf");
    expect(pickDriveFolderForRouted(routed("Adventures library"), file())).toBe("adventures");
    expect(pickDriveFolderForRouted(routed("Practice for Coins log"), file())).toBe("practice");
    expect(pickDriveFolderForRouted(routed("Curriculum Checklist (Weekly)"), file())).toBe("curriculum_checklist");
    expect(pickDriveFolderForRouted(routed("Analytics export"), file())).toBe("analytics");
    expect(pickDriveFolderForRouted(routed("Daily Schedule"), file())).toBe("daily_schedule");
    expect(pickDriveFolderForRouted(routed("Daily Packet"), file())).toBe("worksheets");
    expect(pickDriveFolderForRouted(routed("Finished Work"), file())).toBe("finished_work");
    expect(pickDriveFolderForRouted(routed("Report Card — week of"), file())).toBe("report_cards");
    expect(pickDriveFolderForRouted(routed("Journal entry"), file())).toBe("journal");
    expect(pickDriveFolderForRouted(routed("Adult notes"), file())).toBe("adult_notes");
    expect(pickDriveFolderForRouted(routed("Kiwi Coin redemption"), file())).toBe("kiwi_coins");
  });

  it("DRIVE_FOLDER_NAMES has a non-empty Hub subfolder name for every routable target", () => {
    const targets = Object.keys(DRIVE_FOLDER_NAMES) as Array<keyof typeof DRIVE_FOLDER_NAMES>;
    for (const t of targets) {
      if (t === "reagan") continue; // catch-all stays at Hub root
      expect(DRIVE_FOLDER_NAMES[t].length).toBeGreaterThan(0);
    }
  });
});
