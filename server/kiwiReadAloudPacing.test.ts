import { describe, it, expect } from "vitest";
import { getKiwiReadAloudPacing } from "./_lib/kiwiReadAloudPacing";

describe("kiwiReadAloudPacing — TTS register matches the calm voice rewrite", () => {
  it("defaults to older_cousin profile", () => {
    const r = getKiwiReadAloudPacing();
    expect(r.profile).toBe("older_cousin");
  });

  it("older_cousin: rate < 1.0 (no cheerful default)", () => {
    const r = getKiwiReadAloudPacing("older_cousin");
    expect(r.rate).toBeLessThan(1.0);
  });

  it("older_cousin: pitch < 1.0 (no chirpy default)", () => {
    const r = getKiwiReadAloudPacing("older_cousin");
    expect(r.pitch).toBeLessThan(1.0);
  });

  it("ALL profiles keep pitch <= 1.0 (calm guard)", () => {
    for (const p of ["older_cousin", "neutral_calm", "study_buddy"] as const) {
      const r = getKiwiReadAloudPacing(p);
      expect(r.pitch).toBeLessThanOrEqual(1.0);
    }
  });

  it("neutral_calm uses the slowest rate (most subdued)", () => {
    const oc = getKiwiReadAloudPacing("older_cousin").rate;
    const nc = getKiwiReadAloudPacing("neutral_calm").rate;
    expect(nc).toBeLessThan(oc);
  });

  it("study_buddy keeps rate at 1.0 (focus mode, not slower)", () => {
    const r = getKiwiReadAloudPacing("study_buddy");
    expect(r.rate).toBe(1.0);
  });

  it("voicePreference is 'default' or 'neutral' — never stylized", () => {
    for (const p of ["older_cousin", "neutral_calm", "study_buddy"] as const) {
      const r = getKiwiReadAloudPacing(p);
      expect(["default", "neutral"]).toContain(r.voicePreference);
    }
  });

  it("pauseAfterPeriodMs >= 250 (no rushed sentences)", () => {
    for (const p of ["older_cousin", "neutral_calm", "study_buddy"] as const) {
      const r = getKiwiReadAloudPacing(p);
      expect(r.pauseAfterPeriodMs).toBeGreaterThanOrEqual(250);
    }
  });

  it("SSML hint contains <speak> and <prosody> tags", () => {
    const r = getKiwiReadAloudPacing("older_cousin", "Hi.");
    expect(r.ssmlHint).toContain("<speak>");
    expect(r.ssmlHint).toContain("<prosody");
    expect(r.ssmlHint).toContain("</speak>");
  });

  it("SSML hint inserts <break/> markers after sentence-ending punctuation", () => {
    const r = getKiwiReadAloudPacing("older_cousin", "Hi. How are you? Fine!");
    expect(r.ssmlHint.match(/<break /g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("SSML hint XML-escapes & < > in text", () => {
    const r = getKiwiReadAloudPacing("older_cousin", "Tom & Jerry < cousins >.");
    expect(r.ssmlHint).toContain("Tom &amp; Jerry &lt; cousins &gt;");
  });

  it("SSML rate attribute reflects the profile rate as a percent", () => {
    const r = getKiwiReadAloudPacing("older_cousin");
    expect(r.ssmlHint).toContain('rate="95%"');
  });

  it("SSML pitch attribute formatted in semitones with sign", () => {
    const r = getKiwiReadAloudPacing("neutral_calm");
    // pitch 0.9 → (0.9-1)*10 = -1st
    expect(r.ssmlHint).toContain('pitch="-1st"');
  });

  it("falls back to older_cousin for an unknown profile", () => {
    // @ts-expect-error — testing runtime fallback for unknown id
    const r = getKiwiReadAloudPacing("nope" as KiwiVoiceProfileId);
    expect(r.profile).toBe("older_cousin");
  });

  it("handles empty text without throwing", () => {
    const r = getKiwiReadAloudPacing("older_cousin", "");
    expect(r.ssmlHint).toContain("<speak>");
  });

  it("is deterministic — same profile+text → same output", () => {
    const a = getKiwiReadAloudPacing("older_cousin", "Hi there.");
    const b = getKiwiReadAloudPacing("older_cousin", "Hi there.");
    expect(a).toEqual(b);
  });

  it("rate and pitch are inside SpeechSynthesisUtterance allowed ranges", () => {
    for (const p of ["older_cousin", "neutral_calm", "study_buddy"] as const) {
      const r = getKiwiReadAloudPacing(p);
      expect(r.rate).toBeGreaterThanOrEqual(0.1);
      expect(r.rate).toBeLessThanOrEqual(10);
      expect(r.pitch).toBeGreaterThanOrEqual(0);
      expect(r.pitch).toBeLessThanOrEqual(2);
    }
  });
});
