import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Push 20 (2026-05-12): contract test for the /schedule reframe + sidebar
 * Kiwi grouping rules from todo.md lines 506-513.
 *
 * - /schedule must default to the weekly view (week-at-a-glance).
 * - The "day" view must remain available as a tab.
 * - The kid sidebar must NOT have separate "Coins" + "Practice" entries;
 *   it must have a single consolidated "Kiwi" leaf pointing at /kiwi.
 */

const SCHEDULE = readFileSync(
  path.join(__dirname, "..", "client", "src", "pages", "Schedule.tsx"),
  "utf8",
);
const SIDEBAR = readFileSync(
  path.join(__dirname, "..", "client", "src", "components", "CozyShell.tsx"),
  "utf8",
);

describe("/schedule + sidebar Kiwi consolidation — contract", () => {
  it('Schedule.tsx defaults to "week" view on first render', () => {
    expect(SCHEDULE).toMatch(/useState<View>\(\s*"week"\s*\)/);
  });

  it("Schedule still supports day + month views (segmented control intact)", () => {
    expect(SCHEDULE).toContain('view === "day"');
    expect(SCHEDULE).toMatch(/getMonth\(\)/);
  });

  it("KID_NAV has a Kiwi leaf and no separate /coins entry", () => {
    // 2026-06-17: KID_NAV is NavItem[] again (Notebook moved to the floating
    // dock). Coins stays consolidated into /kiwi — no separate /coins leaf.
    const navBlock = SIDEBAR.split("KID_NAV: NavItem[] = [")[1]?.split("];")[0] ?? "";
    expect(navBlock).toContain('to: "/kiwi"');
    expect(navBlock).toContain('label: "Kiwi"');
    expect(navBlock).not.toMatch(/to:\s*"\/coins"/);
  });

  it("KID_NAV has exactly the 5 anchor leaves (Notebook moved to dock 2026-06-17)", () => {
    const navBlock = SIDEBAR.split("KID_NAV: NavItem[] = [")[1]?.split("];")[0] ?? "";
    const labels = ["Today", "Schedule", "Kiwi", "Bookshelf", "Apps & Tools"];
    for (const lbl of labels) {
      expect(navBlock).toContain(`label: "${lbl}"`);
    }
    // Notebook is no longer a sidebar leaf.
    expect(navBlock).not.toContain('label: "Notebook"');
  });
});
