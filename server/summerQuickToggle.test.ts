import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contract test for the adult SummerQuickToggle (2026-06-18).
 *
 * Mom's intent: a working switch to OPERATE summer mode, not a passive
 * badge. It must (a) be adult-gated so Reagan can't flip it, (b) write the
  *   single canonical `summer.override` key (Auto/On/Off), and (c) be mounted
 *   in the adult-only tray of the OrbDock.
 */

const root = join(__dirname, "..");
const toggle = readFileSync(
  join(root, "client/src/components/SummerQuickToggle.tsx"),
  "utf8",
);
const dock = readFileSync(
  join(root, "client/src/components/OrbDock.tsx"),
  "utf8",
);

describe("SummerQuickToggle", () => {
  it("is gated on the adult lock and never renders for Reagan", () => {
    expect(toggle).toMatch(/useAdultLock/);
    expect(toggle).toMatch(/if\s*\(!unlocked\)\s*return null/);
  });

  it("operates the single canonical summer.override key", () => {
    expect(toggle).toMatch(/key:\s*["']summer\.override["']/);
    // Writes via the familyAdmin-gated prefs.set mutation.
    expect(toggle).toMatch(/prefs\.set\.useMutation/);
  });

  it("offers the three operating modes Auto / On / Off", () => {
    // The testid is built from a template `summer-quick-${m}`; assert the template.
    expect(toggle).toMatch(/summer-quick-\$\{m\}/);
    // Auto clears the override (null); on/off force the value.
    expect(toggle).toMatch(/next === "auto" \? null : next/);
  });

  it("is mounted inside the adult-only tray of the OrbDock", () => {
    expect(dock).toMatch(/import SummerQuickToggle from/);
    expect(dock).toMatch(/<SummerQuickToggle\s*\/>/);
    // The mount is adult-only: it renders after the adult orbs, alongside the
    // tutor toggle, guarded by the adult unlock. Anchor to the adult orb map.
    const adultOrbsIdx = dock.indexOf("adultOrbs.map");
    const mountIdx = dock.indexOf("<SummerQuickToggle");
    expect(adultOrbsIdx).toBeGreaterThan(-1);
    expect(mountIdx).toBeGreaterThan(adultOrbsIdx);
  });
});
