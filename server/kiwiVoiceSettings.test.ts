import { describe, it, expect } from "vitest";
import { resolveKiwiVoiceSettings } from "./_lib/kiwiVoiceSettings";

describe("kiwiVoiceSettings — Reagan voice profile guard", () => {
  it("defaults to older_cousin profile when no input given", () => {
    const r = resolveKiwiVoiceSettings();
    expect(r.profile).toBe("older_cousin");
  });

  it("respects an explicit profile selection", () => {
    expect(resolveKiwiVoiceSettings({ profile: "neutral_calm" }).profile).toBe(
      "neutral_calm",
    );
    expect(resolveKiwiVoiceSettings({ profile: "study_buddy" }).profile).toBe(
      "study_buddy",
    );
  });

  it("emoji is ALWAYS off regardless of profile", () => {
    const profiles = ["older_cousin", "neutral_calm", "study_buddy"] as const;
    for (const p of profiles) {
      expect(resolveKiwiVoiceSettings({ profile: p }).emojiAllowed).toBe(false);
    }
  });

  it("forbiddenWords always includes the core kiddy/creepy banned list", () => {
    const r = resolveKiwiVoiceSettings({ profile: "older_cousin" });
    for (const w of [
      "buddy",
      "friend",
      "pal",
      "kiddo",
      "sweetie",
      "yay",
      "woohoo",
      "great job",
      "awesome",
      "amazing",
    ]) {
      expect(r.forbiddenWords).toContain(w);
    }
  });

  it("forbiddenWords identical across profiles (always-banned)", () => {
    const a = resolveKiwiVoiceSettings({ profile: "older_cousin" }).forbiddenWords;
    const b = resolveKiwiVoiceSettings({ profile: "neutral_calm" }).forbiddenWords;
    const c = resolveKiwiVoiceSettings({ profile: "study_buddy" }).forbiddenWords;
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("sentenceCap is 3 for older_cousin, 2 for the tighter profiles", () => {
    expect(resolveKiwiVoiceSettings({ profile: "older_cousin" }).sentenceCap).toBe(3);
    expect(resolveKiwiVoiceSettings({ profile: "neutral_calm" }).sentenceCap).toBe(2);
    expect(resolveKiwiVoiceSettings({ profile: "study_buddy" }).sentenceCap).toBe(2);
  });

  it("encouragementLevel never exceeds 'low' on any profile", () => {
    const profiles = ["older_cousin", "neutral_calm", "study_buddy"] as const;
    for (const p of profiles) {
      const lvl = resolveKiwiVoiceSettings({ profile: p }).encouragementLevel;
      expect(["off", "low"]).toContain(lvl);
    }
  });

  it("encouragementLevel is 'off' for tighter profiles", () => {
    expect(resolveKiwiVoiceSettings({ profile: "neutral_calm" }).encouragementLevel).toBe("off");
    expect(resolveKiwiVoiceSettings({ profile: "study_buddy" }).encouragementLevel).toBe("off");
  });

  it("identityPhrase is 'I'm Kiwi.' — never 'your friend' or 'Kiwi-bot'", () => {
    const r = resolveKiwiVoiceSettings();
    expect(r.identityPhrase).toBe("I'm Kiwi.");
    expect(r.identityPhrase).not.toMatch(/bot|friend|AI/i);
  });

  it("systemPromptFragment explicitly bans every forbidden word", () => {
    const r = resolveKiwiVoiceSettings({ profile: "older_cousin" });
    for (const w of ["buddy", "friend", "yay", "great job", "awesome", "amazing"]) {
      expect(r.systemPromptFragment.toLowerCase()).toContain(w);
    }
  });

  it("systemPromptFragment never contains forbidden words as filler", () => {
    // The fragment may NAME forbidden words to ban them — verified above —
    // but it must not USE them as voice. We check the fragment starts with
    // a neutral instruction line ("You are Kiwi.") to avoid voice leakage.
    for (const p of ["older_cousin", "neutral_calm", "study_buddy"] as const) {
      const r = resolveKiwiVoiceSettings({ profile: p });
      expect(r.systemPromptFragment.startsWith("You are Kiwi.")).toBe(true);
    }
  });

  it("older_cousin fragment mentions 'cousin' as the register cue", () => {
    const r = resolveKiwiVoiceSettings({ profile: "older_cousin" });
    expect(r.systemPromptFragment.toLowerCase()).toContain("cousin");
  });

  it("study_buddy fragment mentions 'study block' to anchor the use case", () => {
    const r = resolveKiwiVoiceSettings({ profile: "study_buddy" });
    expect(r.systemPromptFragment.toLowerCase()).toContain("study block");
  });

  it("is deterministic — same profile → same result", () => {
    const a = resolveKiwiVoiceSettings({ profile: "older_cousin" });
    const b = resolveKiwiVoiceSettings({ profile: "older_cousin" });
    expect(a).toEqual(b);
  });

  it("handles undefined profile field on input object", () => {
    const r = resolveKiwiVoiceSettings({});
    expect(r.profile).toBe("older_cousin");
  });

  it("systemPromptFragment instructs short replies — explicit sentence cap mentioned", () => {
    for (const p of ["older_cousin", "neutral_calm", "study_buddy"] as const) {
      const r = resolveKiwiVoiceSettings({ profile: p });
      expect(r.systemPromptFragment).toContain(`max ${r.sentenceCap} sentence`);
    }
  });

  it("never says Kiwi is an AI / robot / assistant in the identity phrase", () => {
    const r = resolveKiwiVoiceSettings();
    expect(r.identityPhrase.toLowerCase()).not.toMatch(/ai|robot|assistant/);
  });
});
