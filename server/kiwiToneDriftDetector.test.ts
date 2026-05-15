import { describe, it, expect } from "vitest";
import { detectKiwiToneDrift } from "./_lib/kiwiToneDriftDetector";

describe("kiwiToneDriftDetector — Reagan calm voice rewrite guard", () => {
  it("passes a calm, neutral Kiwi reply (not flagged, low score)", () => {
    const r = detectKiwiToneDrift(
      "Got it. I'll pull up the page from your Tuck Everlasting book.",
    );
    expect(r.flagged).toBe(false);
    expect(r.driftScore).toBeLessThan(4);
    expect(r.reasons).toHaveLength(0);
  });

  it("flags kiddy term 'buddy' (Reagan called Kiwi creepy/kiddy)", () => {
    const r = detectKiwiToneDrift("Hey buddy! Let's get started!");
    expect(r.reasons.some((x) => x.startsWith("kiddy_terms"))).toBe(true);
  });

  it("flags multiple kiddy terms additively", () => {
    const r = detectKiwiToneDrift("Yay buddy! Great job, kiddo!");
    expect(r.flagged).toBe(true);
    expect(r.driftScore).toBeGreaterThanOrEqual(6);
  });

  it("flags creepy trailing tildes (~~~~)", () => {
    const r = detectKiwiToneDrift("Sure thing~~~ I'll get it~~~");
    expect(r.reasons.some((x) => x.startsWith("trailing_tildes"))).toBe(true);
    expect(r.flagged).toBe(true);
  });

  it("flags long ellipses (5+ dots)", () => {
    const r = detectKiwiToneDrift("Hmm......... I see......");
    expect(r.reasons.some((x) => x.startsWith("long_ellipses"))).toBe(true);
  });

  it("flags anthropomorphic over-share ('I'm always here', 'I'm watching')", () => {
    const r1 = detectKiwiToneDrift("Don't worry, I'm always here.");
    expect(r1.reasons.some((x) => x.startsWith("anthropomorphic_overshare"))).toBe(true);

    const r2 = detectKiwiToneDrift("I'm watching for you.");
    expect(r2.reasons.some((x) => x.startsWith("anthropomorphic_overshare"))).toBe(true);
  });

  it("flags 'hehehe' pattern", () => {
    const r = detectKiwiToneDrift("hehe yes, hehehe!");
    expect(r.reasons.some((x) => x.startsWith("hehe"))).toBe(true);
  });

  it("flags imperative-punitive phrases ('you must', 'you have to')", () => {
    const r = detectKiwiToneDrift("You must finish this before lunch.");
    expect(r.reasons.some((x) => x.startsWith("imperative"))).toBe(true);
  });

  it("flags 3+ exclamation marks", () => {
    const r = detectKiwiToneDrift("Wow! Amazing! Super!");
    expect(r.reasons.some((x) => x.startsWith("excess_exclamation"))).toBe(true);
  });

  it("flags ALL CAPS words (skipping allow-list)", () => {
    const r = detectKiwiToneDrift("PLEASE FINISH THIS NOW");
    expect(r.reasons.some((x) => x.startsWith("all_caps"))).toBe(true);
  });

  it("does NOT flag the allow-listed short words (OK, USA, AI, PDF, I)", () => {
    const r = detectKiwiToneDrift("Open the PDF. I think USA is fine. AI is on.");
    expect(r.reasons.find((x) => x.startsWith("all_caps"))).toBeUndefined();
  });

  it("driftScore >= 4 trips flagged=true; <4 stays false", () => {
    const low = detectKiwiToneDrift("Got it.");
    expect(low.flagged).toBe(false);

    const high = detectKiwiToneDrift("Yay buddy! Awesome!"); // kiddy x3 = 6
    expect(high.flagged).toBe(true);
  });

  it("cleanedPreview strips obvious offenders (extra tildes / dots / bangs)", () => {
    const r = detectKiwiToneDrift("Wait...... ok!!! Sure~~~");
    expect(r.cleanedPreview).not.toContain("~~");
    expect(r.cleanedPreview).not.toContain("!!");
    expect(r.cleanedPreview).not.toContain(".....");
  });

  it("safeFallback is calm and never contains forbidden voice words", () => {
    const r = detectKiwiToneDrift("anything");
    expect(r.safeFallback).toBeTruthy();
    expect(r.safeFallback).not.toMatch(/buddy|friend|yay|woohoo|great job|awesome/i);
  });

  it("is deterministic — same input twice → same output", () => {
    const a = detectKiwiToneDrift("Hey buddy! Yay!");
    const b = detectKiwiToneDrift("Hey buddy! Yay!");
    expect(a).toEqual(b);
  });

  it("handles non-string input (undefined) without throwing", () => {
    const r = detectKiwiToneDrift(undefined as unknown as string);
    expect(r.driftScore).toBe(0);
    expect(r.flagged).toBe(false);
  });

  it("handles empty string without throwing", () => {
    const r = detectKiwiToneDrift("");
    expect(r.driftScore).toBe(0);
    expect(r.flagged).toBe(false);
    expect(r.cleanedPreview).toBe("");
  });

  it("matches 'great job' as a multi-word kiddy phrase", () => {
    const r = detectKiwiToneDrift("Great job today.");
    expect(r.reasons.some((x) => x.startsWith("kiddy_terms"))).toBe(true);
  });

  it("case-insensitive on kiddy terms", () => {
    const r = detectKiwiToneDrift("BUDDY, this is great.");
    expect(r.reasons.some((x) => x.startsWith("kiddy_terms"))).toBe(true);
  });
});
