import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { readFileSync } from "fs";
import path from "path";

/**
 * Push 22 (2026-05-12): Lock down the kid-side and adult-side page deletions
 * and dupe-route consolidations from todo.md lines 2410-2417, 2421-2423,
 * 2484-2486, 2621-2627, 2645-2656.
 *
 * The point of this test is to PREVENT regression — if anyone ever re-adds
 * one of these page files or a hard route to one, this test fails.
 */

const PAGES_DIR = path.join(__dirname, "..", "client", "src", "pages");
const APP_TSX = readFileSync(
  path.join(__dirname, "..", "client", "src", "App.tsx"),
  "utf8",
);
const SIDEBAR = readFileSync(
  path.join(__dirname, "..", "client", "src", "components", "CozyShell.tsx"),
  "utf8",
);

const DELETED_PAGE_FILES = [
  "ProudWall.tsx",
  "Adventures.tsx",
  "Journal.tsx",
  "FamilyFeed.tsx",
  "FamilyStream.tsx",
  "UploadOrSync.tsx",
  "DailyAgendas.tsx",
  "DailyPacket.tsx",
  "ParentNotes.tsx",
  "TutorHandoff.tsx",
  "Whiteboard.tsx",
  // Push 61 (2026-05-13) — orphan page modules deleted (no imports anywhere).
  // Each redirects via App.tsx to its closest live page so adults don't 404.
  "Academics.tsx",
  "Animals.tsx",
  "ComponentShowcase.tsx",
  "Home.tsx",
  "KiwiCoins.tsx",
  "Knowledge.tsx",
  "NeedsWork.tsx",
  // Placement.tsx removed from this list (2026-05-17, push v2.20):
  // it was reinstated as a real route after the Push-61 cleanup.
  // The kid-side levels copy is still gated by noKidLevelsContract.
  "PracticeForCoins.tsx",
  "Printables.tsx",
  "Prizes.tsx",
  "Profile.tsx",
  "ReportCard.tsx",
  "ReviewLibrary.tsx",
  "Rewards.tsx",
  "Scratch.tsx",
  "Stickers.tsx",
  "Timeline.tsx",
  "TutorBriefing.tsx",
  "Week.tsx",
];

describe("deleted pages + dupe-route consolidation — contract (push 22)", () => {
  for (const file of DELETED_PAGE_FILES) {
    it(`page file ${file} does NOT exist (deleted per Mom)`, () => {
      expect(existsSync(path.join(PAGES_DIR, file))).toBe(false);
    });
  }

  it("legacy /proud route still resolves (redirects, not 404)", () => {
    expect(APP_TSX).toMatch(/path="\/proud">[\s\S]*?Redirect/);
  });

  it("legacy /journal route still resolves (redirects, not 404)", () => {
    expect(APP_TSX).toMatch(/path="\/journal">[\s\S]*?Redirect/);
  });

  it("legacy /adventures route still resolves (redirects, not 404)", () => {
    expect(APP_TSX).toMatch(/path="\/adventures">[\s\S]*?Redirect/);
  });

  it("legacy /family route still resolves (redirects, not 404)", () => {
    expect(APP_TSX).toMatch(/path="\/family">[\s\S]*?Redirect/);
  });

  it("legacy /levels /rewards /prizes /stickers all redirect to /coins (single Kiwi page)", () => {
    expect(APP_TSX).toMatch(/path="\/levels">[\s\S]*?Redirect[\s\S]*?\/coins/);
    expect(APP_TSX).toMatch(/path="\/rewards">[\s\S]*?Redirect[\s\S]*?\/coins/);
    expect(APP_TSX).toMatch(/path="\/prizes">[\s\S]*?Redirect[\s\S]*?\/coins/);
    expect(APP_TSX).toMatch(/path="\/stickers">[\s\S]*?Redirect[\s\S]*?\/coins/);
  });

  it("/coins renders the Kiwi page; /practice renders Kiwi or PracticeHub", () => {
    // v3.28 (2026-06-01): /practice can route to either Kiwi (legacy
    // consolidation contract) or the dedicated PracticeHub component
    // (current). Either is acceptable; what matters is that both routes
    // are valid kid-safe destinations.
    expect(APP_TSX).toMatch(/path="\/coins"\s+component=\{Kiwi\}/);
    expect(APP_TSX).toMatch(/path="\/practice"\s+component=\{(Kiwi|PracticeHub)\}/);
  });

  it("kid sidebar does NOT include any deleted-page labels", () => {
    const navBlock = SIDEBAR.split("KID_NAV: NavRow[] = [")[1]?.split("];")[0] ?? "";
    const forbidden = ["Proud Wall", "My Levels", "Adventures", "Journal", "Whiteboard", "Rewards", "Prize Shop"];
    for (const label of forbidden) {
      expect(navBlock).not.toContain(`label: "${label}"`);
    }
  });

  it("adult sidebar does NOT include any deleted-page labels", () => {
    const navBlock = SIDEBAR.split("ADULT_NAV: NavItem[] = [")[1]?.split("];")[0] ?? "";
    const forbidden = ["Tutor Handoff", "Family Feed", "Family Stream", "Upload-Sync", "Daily Agendas", "Daily Packet", "Parent Notes", "Whiteboard"];
    for (const label of forbidden) {
      expect(navBlock).not.toContain(`label: "${label}"`);
    }
  });

  it("Push 61 — every Push-61-deleted page has either no route or a Redirect (never a component)", () => {
    // /placement removed from this list (2026-05-17, push v2.20):
    // route was reinstated as a real component=\{Placement\} entry.
    const REDIRECT_OR_NONE = [
      "/academics", "/animals", "/knowledge", "/needs-work",
      "/practice-for-coins", "/printables", "/prizes", "/profile", "/report-card",
      "/review-library", "/rewards", "/scratch", "/stickers", "/timeline",
      "/tutor", "/tutor/:id", "/week",
    ];
    for (const r of REDIRECT_OR_NONE) {
      const escaped = r.replace(/\//g, "\\/").replace(/:/g, "\\:");
      const componentPattern = new RegExp(`path="${escaped}"\\s+component=`);
      expect(APP_TSX).not.toMatch(componentPattern);
    }
  });

  it("FlockWidget jumps to /settings (not deleted /profile)", () => {
    const flockWidget = readFileSync(
      path.join(__dirname, "..", "client", "src", "components", "FlockWidget.tsx"),
      "utf8",
    );
    expect(flockWidget).not.toMatch(/href="\/profile"/);
    expect(flockWidget).toMatch(/href="\/settings"/);
  });

  it("no /tutor-handoff, /upload-sync, /family-feed, /daily-agendas, /daily-packet, /parent-notes hard-component routes left in App.tsx", () => {
    // These should be either fully gone OR redirects. They must NOT have a `component={X}` entry.
    expect(APP_TSX).not.toMatch(/path="\/tutor-handoff"\s+component=/);
    expect(APP_TSX).not.toMatch(/path="\/upload-sync"\s+component=/);
    expect(APP_TSX).not.toMatch(/path="\/family-feed"\s+component=/);
    expect(APP_TSX).not.toMatch(/path="\/daily-agendas"\s+component=/);
    expect(APP_TSX).not.toMatch(/path="\/daily-packet"\s+component=/);
    expect(APP_TSX).not.toMatch(/path="\/parent-notes"\s+component=/);
  });
});
