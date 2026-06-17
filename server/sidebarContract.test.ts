import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Locks the post-cull sidebar layout (May 4 2026).
 *
 * Kid sidebar must be exactly: Today, Schedule, Kiwi, Bookshelf, Apps & Tools.
 * (2026-06-17: Notebook moved out of the sidebar to the floating dock, so the
 * kid sidebar is now 5 anchor leaves — cleaner for Reagan, fewer clicks.)
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

// 2026-05-05 (later) — Coins + Practice merged into ONE consolidated /kiwi
// page. Sidebar collapses back to a single "Kiwi" leaf entry.
// 2026-06-17 — Notebook moved to the floating dock; removed from sidebar.
const KID_REQUIRED = ["Today", "Schedule", "Kiwi", "Bookshelf", "Apps & Tools"];
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
  it("kid sidebar has exactly the 5 anchor labels (Notebook now in dock)", () => {
    for (const label of KID_REQUIRED) {
      expect(kidBlock).toContain(`"${label}"`);
    }
    // Notebook must NOT be a sidebar leaf anymore (lives in the floating dock).
    expect(kidBlock.includes('"Notebook"')).toBe(false);
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

  it("kid sidebar leaf count stays within the agreed band (5–9 leaves)", () => {
    // v3.28 (2026-06-01): sidebar had grown back to 9 leaves. 2026-06-17:
    // Notebook moved to the floating dock, so the floor is now the 5 anchor
    // leaves (KID_REQUIRED) plus optional skill/practice surfaces.
    const matches = kidBlock.match(/label:\s*"[^"]+"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(5);
    expect(matches.length).toBeLessThanOrEqual(10);
  });

  it("adult sidebar has exactly four entries (no creep)", () => {
    const matches = adultBlock.match(/label:\s*"[^"]+"/g) ?? [];
    expect(matches.length).toBe(4);
  });
});
