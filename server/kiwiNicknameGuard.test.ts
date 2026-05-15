import { describe, it, expect } from "vitest";
import { guardKiwiNicknames } from "./_lib/kiwiNicknameGuard";

describe("kiwiNicknameGuard — redact pet-name forms-of-address", () => {
  it("clean text passes through unchanged", () => {
    const r = guardKiwiNicknames("Open the page and read paragraph one.");
    expect(r.changed).toBe(false);
    expect(r.redactedTerms).toEqual([]);
    expect(r.cleanedText).toBe("Open the page and read paragraph one.");
  });

  it("redacts leading 'Sweetie, ...' nickname", () => {
    const r = guardKiwiNicknames("Sweetie, open page 47.");
    expect(r.changed).toBe(true);
    expect(r.redactedTerms).toContain("sweetie");
    expect(r.cleanedText.toLowerCase()).not.toContain("sweetie");
    expect(r.cleanedText).toContain("Open page 47");
  });

  it("redacts trailing ', champ.' nickname", () => {
    const r = guardKiwiNicknames("Try again, champ.");
    expect(r.changed).toBe(true);
    expect(r.redactedTerms).toContain("champ");
    expect(r.cleanedText).toBe("Try again.");
  });

  it("redacts middle vocative ', buddy,' nickname", () => {
    const r = guardKiwiNicknames("Listen, buddy, this is important.");
    expect(r.changed).toBe(true);
    expect(r.redactedTerms).toContain("buddy");
    expect(r.cleanedText.toLowerCase()).not.toContain("buddy");
    expect(r.cleanedText).toContain("Listen");
    expect(r.cleanedText).toContain("important");
  });

  it("does NOT redact Reagan's actual name", () => {
    const r = guardKiwiNicknames("Reagan, open the book.");
    expect(r.changed).toBe(false);
    expect(r.cleanedText).toBe("Reagan, open the book.");
  });

  it("does NOT false-match 'kid' inside 'kids' room' (no vocative position)", () => {
    const r = guardKiwiNicknames("The kids' room is upstairs.");
    expect(r.changed).toBe(false);
  });

  it("does NOT false-match 'sis' inside 'sister' (word-boundary)", () => {
    // "sister" itself IS banned, so just check that 'systematic' isn't caught.
    const r = guardKiwiNicknames("The systematic approach works.");
    expect(r.changed).toBe(false);
  });

  it("redacts 'little one' as a multi-word nickname", () => {
    const r = guardKiwiNicknames("All set, little one.");
    expect(r.changed).toBe(true);
    expect(r.redactedTerms).toContain("little one");
    expect(r.cleanedText.toLowerCase()).not.toContain("little one");
  });

  it("redacts multiple nicknames in one message and lists each once", () => {
    const r = guardKiwiNicknames("Hi, sweetie. Good work, champ.");
    expect(r.changed).toBe(true);
    expect(r.redactedTerms).toEqual(expect.arrayContaining(["sweetie", "champ"]));
  });

  it("case-insensitive — catches 'BUDDY' and 'Pal'", () => {
    const r1 = guardKiwiNicknames("Yo, BUDDY, focus.");
    expect(r1.redactedTerms).toContain("buddy");

    const r2 = guardKiwiNicknames("Sure thing, Pal.");
    expect(r2.redactedTerms).toContain("pal");
  });

  it("collapses double spaces left after redaction", () => {
    const r = guardKiwiNicknames("Listen, buddy, focus.");
    expect(r.cleanedText).not.toMatch(/ {2,}/);
  });

  it("preserves the terminal punctuation when stripping trailing nickname", () => {
    const r = guardKiwiNicknames("Try again, champ!");
    expect(r.cleanedText.slice(-1)).toBe("!");
  });

  it("handles empty input without throwing", () => {
    const r = guardKiwiNicknames("");
    expect(r.changed).toBe(false);
    expect(r.cleanedText).toBe("");
  });

  it("handles non-string input without throwing", () => {
    const r = guardKiwiNicknames(undefined as unknown as string);
    expect(r.changed).toBe(false);
    expect(r.cleanedText).toBe("");
  });

  it("does NOT redact 'kid' when it is a noun in context (no vocative position)", () => {
    const r = guardKiwiNicknames("The kid sitting next to me is reading.");
    // 'kid' here has no leading comma + no trailing comma in a vocative slot,
    // so we don't touch it. The guard is conservative on purpose.
    expect(r.changed).toBe(false);
  });

  it("is deterministic — same input twice → same output", () => {
    const a = guardKiwiNicknames("Listen, sweetie, focus.");
    const b = guardKiwiNicknames("Listen, sweetie, focus.");
    expect(a).toEqual(b);
  });

  it("redactedTerms sorted alphabetically for stable audit", () => {
    const r = guardKiwiNicknames("Sweetie, hi. Bye, champ.");
    expect(r.redactedTerms).toEqual([...r.redactedTerms].sort());
  });
});
