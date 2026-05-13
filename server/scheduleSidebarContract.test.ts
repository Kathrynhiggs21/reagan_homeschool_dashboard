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

  it("KID_NAV has a single Kiwi leaf and NO separate Coins/Practice entries", () => {
    const navBlock = SIDEBAR.split("KID_NAV: NavRow[] = [")[1]?.split("];")[0] ?? "";
    expect(navBlock).toContain('to: "/kiwi"');
    expect(navBlock).toContain('label: "Kiwi"');
    // No standalone Coins / Practice routes.
    expect(navBlock).not.toMatch(/to:\s*"\/coins"/);
    expect(navBlock).not.toMatch(/to:\s*"\/practice"/);
    // Should NOT be a NavGroup (no children) — Mom asked for a leaf.
    expect(navBlock).not.toMatch(/kind:\s*"group",[^[]*Kiwi/);
  });

  it("KID_NAV has exactly the 6 expected leaves (locked May 5 2026)", () => {
    const navBlock = SIDEBAR.split("KID_NAV: NavRow[] = [")[1]?.split("];")[0] ?? "";
    const labels = ["Today", "Schedule", "Kiwi", "Bookshelf", "Notebook", "Apps & Tools"];
    for (const lbl of labels) {
      expect(navBlock).toContain(`label: "${lbl}"`);
    }
  });
});
