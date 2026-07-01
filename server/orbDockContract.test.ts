import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
/**
 * Locks the canonical navigation layout (2026-07-01 liquid-glass redesign).
 *
 * The left sidebar was replaced by the floating glass OrbDock. The nav
 * contract now lives in OrbDock.tsx:
 *   - KID_ORBS: exactly Today, Schedule, Kiwi, Books, Apps.
 *   - ADULT_ORBS: exactly Curriculum, Agenda Editor, Idea Library,
 *     Analytics, Settings (behind the Parent orb).
 * Deleted concepts must not reappear.
 */
const DOCK_PATH = resolve(
  __dirname,
  "..",
  "client",
  "src",
  "components",
  "OrbDock.tsx",
);
const source = readFileSync(DOCK_PATH, "utf8");

function extractArrayLiteral(name: string): string {
  const re = new RegExp(`const\\s+${name}\\s*:\\s*Orb\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\];`, "m");
  const match = source.match(re);
  if (!match) throw new Error(`could not find ${name} in OrbDock.tsx`);
  return match[1];
}
const kidBlock = extractArrayLiteral("KID_ORBS");
const adultBlock = extractArrayLiteral("ADULT_ORBS");

const KID_REQUIRED = ["Today", "Schedule", "Kiwi", "Books", "Apps"];
const ADULT_REQUIRED = ["Curriculum", "Agenda Editor", "Idea Library", "Analytics", "Settings"];
const KID_FORBIDDEN = ["Proud Wall", "My Levels", "About Me", "Journal", "Rewards"];
const ADULT_FORBIDDEN = [
  "Tutor Handoff",
  "Family Update",
  "Family Stream",
  "Upload or Sync",
  "Daily Packet",
  "Parent Notes",
  "AI Assistant",
  "Assignments Library",
  "Rewards / Prizes",
  "Daily Schedule",
];

describe("orb dock nav contract", () => {
  it("kid dock has exactly the 5 anchor orbs", () => {
    for (const label of KID_REQUIRED) {
      expect(kidBlock).toContain(`label: "${label}"`);
    }
    const matches = kidBlock.match(/label:\s*"[^"]+"/g) ?? [];
    expect(matches.length).toBe(5);
  });
  it("kid dock contains none of the deleted labels", () => {
    for (const label of KID_FORBIDDEN) {
      expect(kidBlock.includes(`label: "${label}"`)).toBe(false);
    }
  });
  it("adult tray has exactly the 5 required orbs", () => {
    for (const label of ADULT_REQUIRED) {
      expect(adultBlock).toContain(`label: "${label}"`);
    }
    const matches = adultBlock.match(/label:\s*"[^"]+"/g) ?? [];
    expect(matches.length).toBe(5);
  });
  it("adult tray contains none of the consolidated/deleted labels", () => {
    for (const label of ADULT_FORBIDDEN) {
      expect(adultBlock.includes(`label: "${label}"`)).toBe(false);
    }
  });
  it("kid orbs point at the canonical kid routes", () => {
    for (const to of ["/today", "/schedule", "/kiwi", "/bookshelf", "/apps"]) {
      expect(kidBlock).toContain(`to: "${to}"`);
    }
  });
});
