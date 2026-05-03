import { describe, it, expect } from "vitest";
import {
  COMPANION_IDS,
  COMPANION_VOICES,
  getCompanionConfig,
  pickVoiceForCompanion,
  speakAs,
} from "../client/src/lib/companionVoices";

describe("companionVoices — per-character voice registry", () => {
  it("includes the four flock members (kiwi, blue, daffy, honk)", () => {
    expect(COMPANION_IDS).toEqual(["kiwi", "blue", "daffy", "honk"]);
    for (const id of COMPANION_IDS) {
      expect(COMPANION_VOICES[id]).toBeDefined();
    }
  });

  it("each config has valid rate/pitch/volume ranges and a non-empty preferred list", () => {
    for (const id of COMPANION_IDS) {
      const cfg = COMPANION_VOICES[id];
      expect(cfg.rate).toBeGreaterThanOrEqual(0.1);
      expect(cfg.rate).toBeLessThanOrEqual(10);
      expect(cfg.pitch).toBeGreaterThanOrEqual(0);
      expect(cfg.pitch).toBeLessThanOrEqual(2);
      expect(cfg.volume).toBeGreaterThanOrEqual(0);
      expect(cfg.volume).toBeLessThanOrEqual(1);
      expect(cfg.preferred.length).toBeGreaterThan(0);
      expect(cfg.blurb.length).toBeGreaterThan(0);
    }
  });

  it("companions have distinguishable pitch/rate combinations", () => {
    const fingerprints = COMPANION_IDS.map((id) => {
      const c = COMPANION_VOICES[id];
      return `${c.rate}:${c.pitch}`;
    });
    const set = new Set(fingerprints);
    expect(set.size).toBe(fingerprints.length);
  });

  it("getCompanionConfig falls back to kiwi for unknown ids and null", () => {
    expect(getCompanionConfig("does-not-exist")).toEqual(COMPANION_VOICES.kiwi);
    expect(getCompanionConfig(null)).toEqual(COMPANION_VOICES.kiwi);
    expect(getCompanionConfig(undefined)).toEqual(COMPANION_VOICES.kiwi);
  });

  it("pickVoiceForCompanion respects the preferred regex order", () => {
    const fakeVoices: any[] = [
      { name: "Microsoft David Desktop", lang: "en-US" },
      { name: "Samantha", lang: "en-US" },
      { name: "Google US English", lang: "en-US" },
      { name: "Daniel", lang: "en-GB" },
    ];
    // Kiwi prefers Samantha first.
    expect(pickVoiceForCompanion("kiwi", fakeVoices)?.name).toBe("Samantha");
    // Honk prefers Daniel first.
    expect(pickVoiceForCompanion("honk", fakeVoices)?.name).toBe("Daniel");
  });

  it("pickVoiceForCompanion handles empty voice list gracefully", () => {
    expect(pickVoiceForCompanion("kiwi", [])).toBeUndefined();
    expect(pickVoiceForCompanion("kiwi", undefined as any)).toBeUndefined();
  });

  it("speakAs is a safe no-op outside a browser", () => {
    expect(() => speakAs("kiwi", "hello")).not.toThrow();
    expect(() => speakAs("honk", "BIG NOTE")).not.toThrow();
    expect(() => speakAs("not-real" as any, "fallback")).not.toThrow();
  });
});
