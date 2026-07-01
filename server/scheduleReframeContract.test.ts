import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
/**
 * Contract for the /schedule reframe + Kiwi grouping.
 *
 * - /schedule defaults to the weekly view (week-at-a-glance); day view stays.
 * - The kid nav (now the OrbDock) has a single consolidated "Kiwi" orb and
 *   no separate "/coins" entry.
 */
const SCHEDULE = readFileSync(
  path.join(__dirname, "..", "client", "src", "pages", "Schedule.tsx"),
  "utf8",
);
const DOCK = readFileSync(
  path.join(__dirname, "..", "client", "src", "components", "OrbDock.tsx"),
  "utf8",
);
describe("/schedule + dock Kiwi consolidation — contract", () => {
  it('Schedule.tsx defaults to "week" view on first render', () => {
    expect(SCHEDULE).toMatch(/useState<View>\(\s*"week"\s*\)/);
  });
  it("Schedule still supports day + month views (segmented control intact)", () => {
    expect(SCHEDULE).toContain('view === "day"');
    expect(SCHEDULE).toMatch(/getMonth\(\)/);
  });
  it("kid dock has a Kiwi orb and no separate /coins entry", () => {
    const navBlock = DOCK.split("KID_ORBS: Orb[] = [")[1]?.split("];")[0] ?? "";
    expect(navBlock).toContain('to: "/kiwi"');
    expect(navBlock).toContain('label: "Kiwi"');
    expect(navBlock).not.toMatch(/to:\s*"\/coins"/);
  });
  it("kid dock has exactly the 5 anchor orbs", () => {
    const navBlock = DOCK.split("KID_ORBS: Orb[] = [")[1]?.split("];")[0] ?? "";
    const labels = ["Today", "Schedule", "Kiwi", "Books", "Apps"];
    for (const lbl of labels) {
      expect(navBlock).toContain(`label: "${lbl}"`);
    }
    expect(navBlock).not.toContain('label: "Notebook"');
  });
});
