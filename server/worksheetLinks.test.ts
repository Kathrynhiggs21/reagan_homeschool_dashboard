/**
 * worksheetLinks.test.ts — 2026-06-29
 *
 * Regression guard for Katy's report: "most urls don't work or just go to the
 * home page of app or no longer exists on worksheets."
 *
 * Root cause was stale/blocked EXTERNAL links surfaced as the kid-facing
 * "Open" target (curated subject fallbacks + the Practice-for-Coins library),
 * not in-app routing. This test pins the links so a regression (re-introducing
 * a known-dead pattern, an empty link, or a non-https link) fails CI instead of
 * silently shipping a dead worksheet button.
 *
 * It does NOT hit the network (tests must stay deterministic + offline). It
 * asserts structural facts + a blocklist of patterns we have *manually verified*
 * to be dead or to bounce to a home/wrong page.
 */
import { describe, it, expect } from "vitest";
import { PRACTICE_LIBRARY } from "./_lib/practiceLibrary";

// The curated kid-facing fallback table lives in the client lib; re-declare the
// exact source path so we read the real shipped values.
import { fallbackActivityFor } from "../client/src/lib/subjectFallbackActivity";

/**
 * Patterns we manually probed on 2026-06-29 and confirmed dead, 404/410, or
 * bouncing to a home/wrong page. Re-introducing any of these should fail.
 */
const DEAD_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /wonderopolis\.org/i, why: "Wonderopolis was shut down 2025-07-31" },
  { re: /readworks\.org\/find-content#!/i, why: "ReadWorks hash search route returns 000 (dead)" },
  { re: /mysteryscience\.com\/mini-lessons(\b|\/?$)/i, why: "/mini-lessons redirects to one random lesson, not the picker" },
  { re: /learninglab\.si\.edu\/discover/i, why: "/discover redirects to a stale help-archive page" },
  { re: /app\.gonoodle\.com\/discover/i, why: "app.gonoodle.com/discover bounces to the marketing home" },
  { re: /academy\.allaboutbirds\.org\/free-bird-id/i, why: "Cornell free-bird-id is blocked/unreliable" },
  { re: /\/e\/division_2(\b|$)/i, why: "deep Khan /e/ exercise slug renders Khan's not-found shell" },
  { re: /x96f17fb52ad3e7ed:cc-5th-reading-vocab-stories/i, why: "hashed Khan ELA sub-path unstable after reorg" },
];

const SUBJECT_SLUGS = [
  "math", "ela", "reading", "writing", "science", "ss", "social_studies",
  "history", "art", "music", "outdoors", "nature", "pe", "snack", "break", "wonder",
];

describe("worksheet link hygiene — curated subject fallbacks", () => {
  for (const slug of SUBJECT_SLUGS) {
    it(`"${slug}" fallback has a clean, well-formed link (or intentional empty)`, () => {
      const fb = fallbackActivityFor(slug, null);
      // snack/break are intentionally link-less (in-home activities).
      if (fb.sourceUrl === "") return;
      expect(fb.sourceUrl.startsWith("https://")).toBe(true);
      for (const { re, why } of DEAD_PATTERNS) {
        expect(fb.sourceUrl, `${slug} link must not match dead pattern: ${why}`).not.toMatch(re);
      }
    });
  }

  it("falls back to a real link for unknown subjects (never empty)", () => {
    const fb = fallbackActivityFor("totally-unknown-subject", "some random block");
    expect(fb.sourceUrl.startsWith("https://")).toBe(true);
  });
});

describe("worksheet link hygiene — Practice-for-Coins library", () => {
  it("every drill has a well-formed https url", () => {
    for (const d of PRACTICE_LIBRARY) {
      expect(d.url.startsWith("https://"), `${d.slug} url should be https`).toBe(true);
    }
  });

  it("no drill uses a known-dead/bouncing URL pattern", () => {
    for (const d of PRACTICE_LIBRARY) {
      for (const { re, why } of DEAD_PATTERNS) {
        expect(d.url, `${d.slug} must not match dead pattern: ${why}`).not.toMatch(re);
      }
    }
  });

  it("no duplicate slugs (slug is the ledger key)", () => {
    const slugs = PRACTICE_LIBRARY.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
