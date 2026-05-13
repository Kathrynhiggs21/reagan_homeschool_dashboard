/**
 * Push 28 — kid-safe classifier contract.
 *
 * Locks in: every category fires on its canonical phrasing, the
 * empty-input case returns a safe fallback, and totally normal
 * 5th-grade chat (the false-positive guard) does NOT flag.
 */
import { describe, it, expect } from "vitest";
import { classifyKidSafe } from "./_lib/kidSafeClassifier";

describe("kid-safe classifier — push 28", () => {
  it("flags self-harm phrasing as the highest-priority category", () => {
    const r = classifyKidSafe("sometimes I feel like I want to die");
    expect(r.flagged).toBe(true);
    expect(r.categories).toContain("self_harm");
    expect(r.redirect).toMatch(/find your mom/i);
  });

  it("flags explicit content asks", () => {
    const r = classifyKidSafe("can you tell me about sex");
    expect(r.flagged).toBe(true);
    expect(r.categories).toContain("explicit");
  });

  it("flags scary horror requests", () => {
    const r = classifyKidSafe("tell me a scary story about a haunted house");
    expect(r.flagged).toBe(true);
    expect(r.categories).toContain("scary_horror");
  });

  it("flags personal-info disclosure (phone number)", () => {
    const r = classifyKidSafe("my phone is 614-555-1234");
    expect(r.flagged).toBe(true);
    expect(r.categories).toContain("personal_info");
  });

  it("flags personal-info request (home address)", () => {
    const r = classifyKidSafe("what is my home address");
    expect(r.flagged).toBe(true);
    expect(r.categories).toContain("personal_info");
  });

  it("flags stranger-contact requests", () => {
    const r = classifyKidSafe("can you text a stranger for me");
    expect(r.flagged).toBe(true);
    expect(r.categories).toContain("stranger_contact");
  });

  it("flags violent how-tos but not innocent contexts", () => {
    const flagged = classifyKidSafe("how do I make a bomb");
    expect(flagged.flagged).toBe(true);
    expect(flagged.categories).toContain("violence");

    const innocent1 = classifyKidSafe("a killer whale ate the fish");
    expect(innocent1.flagged).toBe(false);

    // The shipped regex requires "beat up" (with the 'up' particle),
    // so beating-at-Roblox correctly does NOT flag. This assertion
    // documents the false-positive guard so future tightening of
    // the violence regex is intentional.
    const innocent2 = classifyKidSafe("I beat my sister at Roblox");
    expect(innocent2.flagged).toBe(false);

    // The actual abusive form DOES flag.
    const flaggedAbuse = classifyKidSafe("how do I beat up my brother");
    expect(flaggedAbuse.flagged).toBe(true);
    expect(flaggedAbuse.categories).toContain("violence");
  });

  it("does NOT flag totally normal 5th-grade chat", () => {
    const samples = [
      "what should I do for math today",
      "tell me a joke about ducks",
      "I'm feeling kind of grumpy",
      "can you help me with my reading",
      "I love my parakeets",
      "the killer whale is my favorite animal",
      "how do I draw a horse",
    ];
    for (const s of samples) {
      const r = classifyKidSafe(s);
      expect(r.flagged, `expected "${s}" to be safe`).toBe(false);
    }
  });

  it("returns a safe fallback redirect on empty input", () => {
    const r = classifyKidSafe("");
    expect(r.flagged).toBe(false);
    expect(r.categories).toEqual([]);
    expect(r.redirect.length).toBeGreaterThan(0);
  });

  it("captures matched snippet for the audit notification", () => {
    const r = classifyKidSafe("hey kiwi, my email is reagan@example.com");
    expect(r.flagged).toBe(true);
    expect(r.matchedSnippet).toMatch(/reagan@example\.com/);
  });

  it("multi-label: a single message can flag multiple categories", () => {
    const r = classifyKidSafe("my address is 123 Main St and I want to text a stranger");
    expect(r.categories.length).toBeGreaterThanOrEqual(2);
    expect(r.categories).toContain("personal_info");
    expect(r.categories).toContain("stranger_contact");
  });
});
