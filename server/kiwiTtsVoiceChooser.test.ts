import { describe, it, expect } from "vitest";
import {
  chooseKiwiTtsVoice,
  type TtsVoiceCandidate,
} from "./_lib/kiwiTtsVoiceChooser";

function v(
  name: string,
  lang = "en-US",
  voiceURI = name,
  isDefault = false,
): TtsVoiceCandidate {
  return { name, lang, voiceURI, default: isDefault };
}

describe("kiwiTtsVoiceChooser — neutral voice picker (no kids/cartoon)", () => {
  it("returns null with reason when voice list is empty", () => {
    const r = chooseKiwiTtsVoice([]);
    expect(r.voiceURI).toBeNull();
    expect(r.reason).toBe("no_voices_available_use_browser_default");
  });

  it("returns null with reason when voices argument is undefined", () => {
    const r = chooseKiwiTtsVoice(undefined);
    expect(r.voiceURI).toBeNull();
  });

  it("blocks any voice with 'Kids' in the name", () => {
    const r = chooseKiwiTtsVoice([
      v("Microsoft Aria Kids"),
      v("Microsoft Aria Standard"),
    ]);
    expect(r.name).toBe("Microsoft Aria Standard");
  });

  it("blocks 'Child', 'Junior', 'Cartoon', 'Novelty', 'Whisper', 'Robot', 'Alien'", () => {
    const r = chooseKiwiTtsVoice([
      v("Child Voice"),
      v("Junior Voice"),
      v("Cartoon Hero"),
      v("Novelty Whisper"),
      v("Whisper Voice"),
      v("Robot Voice"),
      v("Alien Voice"),
      v("Microsoft Aria Natural"),
    ]);
    expect(r.name).toBe("Microsoft Aria Natural");
  });

  it("returns null with 'all_voices_blocked' when only blocked names remain", () => {
    const r = chooseKiwiTtsVoice([v("Cartoon Pal"), v("Robot Jr.")]);
    expect(r.voiceURI).toBeNull();
    expect(r.reason).toBe("all_voices_blocked_use_browser_default");
  });

  it("prefers an English voice over a non-English one", () => {
    const r = chooseKiwiTtsVoice([
      v("Helena", "de-DE"),
      v("Aria", "en-US"),
    ]);
    expect(r.name).toBe("Aria");
  });

  it("prefers allow-token 'standard' over a no-token voice", () => {
    const r = chooseKiwiTtsVoice([v("Aria"), v("Aria Standard")]);
    expect(r.name).toBe("Aria Standard");
  });

  it("prefers 'natural' when 'standard' is missing", () => {
    const r = chooseKiwiTtsVoice([v("Aria"), v("Aria Natural")]);
    expect(r.name).toBe("Aria Natural");
  });

  it("allow-token priority order: standard > neutral > natural > default", () => {
    // Standard wins over neutral.
    const r1 = chooseKiwiTtsVoice([v("Aria Neutral"), v("Aria Standard")]);
    expect(r1.name).toBe("Aria Standard");
    // Neutral wins over natural.
    const r2 = chooseKiwiTtsVoice([v("Aria Natural"), v("Aria Neutral")]);
    expect(r2.name).toBe("Aria Neutral");
  });

  it("falls back to browser-default English voice when no allow-tokens match", () => {
    const r = chooseKiwiTtsVoice([
      v("Aria", "en-US", "aria", false),
      v("Samantha", "en-US", "samantha", true),
    ]);
    expect(r.name).toBe("Samantha");
    expect(r.reason).toBe("browser_default_english");
  });

  it("falls back to first English voice when nothing else qualifies", () => {
    const r = chooseKiwiTtsVoice([v("Aria"), v("Samantha")]);
    expect(r.name).toBe("Aria");
    expect(r.reason).toBe("first_surviving_voice");
  });

  it("returns the voiceURI exactly so the frontend can use it as ID", () => {
    const r = chooseKiwiTtsVoice([
      v("Aria Standard", "en-US", "microsoft-aria-standard"),
    ]);
    expect(r.voiceURI).toBe("microsoft-aria-standard");
  });

  it("is deterministic — same input twice → same output", () => {
    const list = [v("Aria"), v("Aria Standard")];
    const a = chooseKiwiTtsVoice(list);
    const b = chooseKiwiTtsVoice(list);
    expect(a).toEqual(b);
  });

  it("treats 'en-GB' and 'en_AU' as English", () => {
    const r1 = chooseKiwiTtsVoice([
      v("Helena", "de-DE"),
      v("Daniel", "en-GB"),
    ]);
    expect(r1.name).toBe("Daniel");

    const r2 = chooseKiwiTtsVoice([v("Helena", "de-DE"), v("Lee", "en_AU")]);
    expect(r2.name).toBe("Lee");
  });

  it("does NOT block voices whose name happens to contain 'default' (allow-list trumps blocklist semantics)", () => {
    const r = chooseKiwiTtsVoice([v("System Default Voice")]);
    expect(r.name).toBe("System Default Voice");
  });

  it("falls back to non-English pool only if no English survives", () => {
    const r = chooseKiwiTtsVoice([v("Helena", "de-DE")]);
    expect(r.name).toBe("Helena");
  });

  it("case-insensitive on blocklist token match", () => {
    const r = chooseKiwiTtsVoice([v("KIDS BOT"), v("Aria")]);
    expect(r.name).toBe("Aria");
  });
});
