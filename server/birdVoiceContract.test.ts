import { describe, it, expect } from "vitest";
import * as bv from "../client/src/lib/birdVoice";

/**
 * Phase 9: TurnInDialog "Read to me" button calls speakLikeBird(text).
 * We can't run SpeechSynthesis in node, but we can verify the public surface
 * the dialog depends on still exists and remains a no-op outside the browser.
 */
describe("birdVoice public surface (Phase 9)", () => {
  it("exports speakLikeBird and chirp", () => {
    expect(typeof bv.speakLikeBird).toBe("function");
    expect(typeof bv.chirp).toBe("function");
  });

  it("speakLikeBird is a safe no-op outside a browser (no throw, no error)", () => {
    expect(() => bv.speakLikeBird("hello reagan")).not.toThrow();
  });

  it("BIRD_VOICE_CONFIG carries kid-friendly voice tuning", () => {
    expect(bv.BIRD_VOICE_CONFIG.pitch).toBeGreaterThan(1);
    expect(bv.BIRD_VOICE_CONFIG.volume).toBeGreaterThan(0);
  });
});
