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

  it("guards the dad launcher behind unlocked + dadEmail + isGoogleUrl", () => {
    expect(src).toMatch(/unlocked && dadEmail && isGoogleUrl\(a\.url\)/);
  });

  it("uses withGoogleAuthUser for both identities", () => {
    expect(src).toContain("withGoogleAuthUser(a.url, reaganEmail)");
    expect(src).toContain("withGoogleAuthUser(a.url, dadEmail)");
  });
});
