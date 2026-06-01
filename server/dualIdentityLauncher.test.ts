import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contract test \u2014 Phase 3: per-app dual identity (Student + Parent Google sign-in).
 * Apps page must surface BOTH the student account (via the main card link) and
 * an adult-only "Open as Dad" overlay link that uses the parent google email.
 */
describe("Apps page \u2014 per-app dual identity", () => {
  const root = join(__dirname, "..");
  const src = readFileSync(join(root, "client/src/pages/Apps.tsx"), "utf8");

  it("looks up both student.googleEmail and parent.googleEmail prefs", () => {
    expect(src).toContain('key: "student.googleEmail"');
    expect(src).toContain('key: "parent.googleEmail"');
  });

  it("renders an 'Open as Dad' link", () => {
    expect(src).toContain("Open as Dad");
  });

  it("guards the dad launcher behind dadEmail + reaganEmail + isGoogleUrl", () => {
    // v3.28 (2026-06-01): the gate dropped the `unlocked` prefix because
    // the dad launcher is now intentionally always discoverable when both
    // identities are configured (it sits as a small overlay button on the
    // card, not a hidden control). The gate now requires both Google
    // emails and a Google-host URL.
    expect(src).toMatch(/dadEmail && reaganEmail && isGoogleUrl\(a\.url\)/);
  });

  it("uses withGoogleSsoHint for both identities (Phase 8 upgrade)", () => {
    // withGoogleSsoHint falls through to withGoogleAuthUser for google.com
    // hosts and additionally wraps third-party Google-SSO apps via the
    // AccountChooser intermediary so the right account is pre-picked.
    expect(src).toContain("withGoogleSsoHint(a.url, reaganEmail)");
    expect(src).toContain("withGoogleSsoHint(a.url, dadEmail)");
  });
});
