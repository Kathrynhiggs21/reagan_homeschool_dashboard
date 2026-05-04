import { describe, it, expect } from "vitest";
import {
  BIRD_VOICE_CONFIG,
  pickBirdVoice,
  chirp,
  speakLikeBird,
} from "../client/src/lib/birdVoice";

describe("birdVoice", () => {
  it("exposes a bright tween-bird pitch/rate preset", () => {
    // Tween-girl-meets-bird tuning: pitch should be noticeably above default.
    expect(BIRD_VOICE_CONFIG.pitch).toBeGreaterThanOrEqual(1.7);
    expect(BIRD_VOICE_CONFIG.rate).toBeGreaterThan(1.1);
    expect(BIRD_VOICE_CONFIG.volume).toBeLessThanOrEqual(1);
    expect(BIRD_VOICE_CONFIG.volume).toBeGreaterThan(0.5);
  });

  it("pickBirdVoice prefers bright/female voices over male/deep", () => {
    const voices = [
      { name: "Daniel", lang: "en-GB" },
      { name: "Fred", lang: "en-US" },
      { name: "Samantha", lang: "en-US" },
      { name: "Alex", lang: "en-US" },
    ] as unknown as SpeechSynthesisVoice[];
    const v = pickBirdVoice(voices);
    expect(v?.name).toBe("Samantha");
  });

  it("pickBirdVoice falls back to any en voice (skipping male) if no preferred", () => {
    const voices = [
      { name: "Daniel", lang: "en-GB" },
      { name: "Mia", lang: "en-US" },
    ] as unknown as SpeechSynthesisVoice[];
    const v = pickBirdVoice(voices);
    expect(v?.name).toBe("Mia");
  });

  it("pickBirdVoice returns undefined on empty list", () => {
    expect(pickBirdVoice([])).toBeUndefined();
  });

  it("chirp + speakLikeBird do not throw in a non-browser environment", () => {
    expect(() => chirp()).not.toThrow();
    expect(() => speakLikeBird("hello")).not.toThrow();
  });
});
