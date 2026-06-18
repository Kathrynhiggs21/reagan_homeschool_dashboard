import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contract test for the adult SummerQuickToggle (2026-06-18).
 *
 * Mom's intent: a working switch to OPERATE summer mode, not a passive
 * badge. It must (a) be adult-gated so Reagan can't flip it, (b) write the
 * single canonical `summer.override` key (Auto/On/Off), and (c) be mounted
 * in the adult-only sidebar section.
 */

const root = join(__dirname, "..");
const toggle = readFileSync(
  join(root, "client/src/components/SummerQuickToggle.tsx"),
  "utf8",
);
const shell = readFileSync(
  join(root, "client/src/components/CozyShell.tsx"),
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

  it("is mounted inside the adult-only sidebar section of CozyShell", () => {
    expect(shell).toMatch(/import SummerQuickToggle from/);
    expect(shell).toMatch(/<SummerQuickToggle\s*\/>/);
    // The mount sits within the `unlocked && (...)` adult block.
    const adultBlockStart = shell.indexOf("Adult section: only visible when unlocked");
    const mountIdx = shell.indexOf("<SummerQuickToggle");
    // Anchor to the adult Drive Hub <a> link (rendered after the toggle in JSX).
    const drivehubLinkIdx = shell.indexOf("Opens Reagan's Drive folder in a new tab");
    expect(adultBlockStart).toBeGreaterThan(-1);
    expect(mountIdx).toBeGreaterThan(adultBlockStart);
    // and before the adult Drive Hub link that closes the adult nav group.
    expect(mountIdx).toBeLessThan(drivehubLinkIdx);
  });
});
