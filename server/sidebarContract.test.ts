import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Locks the post-cull sidebar layout (May 4 2026).
 *
 * Kid sidebar must be exactly: Today, Schedule, Kiwi Coins, Practice, Bookshelf, Notebook, Apps & Tools.
 * Adult sidebar must be exactly: Curriculum Hub, Daily Schedule, Agenda Editor, Settings.
 * Deleted concepts (Proud Wall, My Levels, Tutor Handoff, Family Stream/Update,
 * Upload-Sync, Daily Packet, Parent Notes, separate Analytics page, separate
 * AI Assistant page, separate Rewards page, About Me) must not appear in either nav.
 */

const SHELL_PATH = resolve(
  __dirname,
  "..",
  "client",
  "src",
  "components",
  "CozyShell.tsx",
);

const source = readFileSync(SHELL_PATH, "utf8");

// Pull just the inside of KID_NAV / ADULT_NAV array literals so we don't
// false-positive on comments above the array. KID_NAV is now NavRow[]
// (since 2026-05-05 Kiwi Coins + Practice grouping), ADULT_NAV stays
// NavItem[].
function extractArrayLiteral(name: string): string {
  const re = new RegExp(`const\\s+${name}\\s*:\\s*(?:NavItem|NavRow)\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\];`, "m");
  const match = source.match(re);
  if (!match) throw new Error(`could not find ${name} in CozyShell.tsx`);
  return match[1];
}

const kidBlock = extractArrayLiteral("KID_NAV");
const adultBlock = extractArrayLiteral("ADULT_NAV");

// 2026-05-05 — Kiwi Coins + Practice grouped under a "Kiwi" parent. Their
// labels under that group are simplified to "Coins" and "Practice".
const KID_REQUIRED = ["Today", "Schedule", "Coins", "Practice", "Bookshelf", "Notebook", "Apps & Tools"];
// 2026-05-05 — "Daily Schedule" page deleted; "Analytics" added back as a real adult page.
const ADULT_REQUIRED = ["Curriculum Hub", "Agenda Editor", "Analytics", "Settings"];

const KID_FORBIDDEN = ["Proud Wall", "My Levels", "About Me", "Adventures", "Journal", "Rewards"];
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

describe("sidebar contract", () => {
  it("kid sidebar has exactly the 7 required labels", () => {
    for (const label of KID_REQUIRED) {
      expect(kidBlock).toContain(`"${label}"`);
    }
  });

  it("kid sidebar contains none of the deleted labels", () => {
    for (const label of KID_FORBIDDEN) {
      expect(kidBlock.includes(`"${label}"`)).toBe(false);
    }
  });

  it("adult sidebar has exactly the 4 required labels", () => {
    for (const label of ADULT_REQUIRED) {
      expect(adultBlock).toContain(`"${label}"`);
    }
  });

  it("adult sidebar contains none of the consolidated/deleted labels", () => {
    for (const label of ADULT_FORBIDDEN) {
      expect(adultBlock.includes(`"${label}"`)).toBe(false);
    }
  });

  it("kid sidebar has exactly seven leaf entries (no creep), counting children of groups", () => {
    const matches = kidBlock.match(/label:\s*"[^"]+"/g) ?? [];
    // 7 leaves + 1 group header ("Kiwi") = 8 label tokens total
    expect(matches.length).toBe(8);
  });

  it("adult sidebar has exactly four entries (no creep)", () => {
    const matches = adultBlock.match(/label:\s*"[^"]+"/g) ?? [];
    expect(matches.length).toBe(4);
  });
});
