import { describe, it, expect } from "vitest";
import {
  resolveKiwiVoiceProfile,
  listKiwiPanels,
} from "./_lib/kiwiVoiceProfileResolver";

describe("kiwiVoiceProfileResolver — panel → profile routing", () => {
  it("today panel → older_cousin", () => {
    const r = resolveKiwiVoiceProfile("today");
    expect(r.profile).toBe("older_cousin");
    expect(r.rationale).toMatch(/older[ -]cousin/i);
  });

  it("kiwi panel → older_cousin", () => {
    expect(resolveKiwiVoiceProfile("kiwi").profile).toBe("older_cousin");
  });

  it("schedule panel → neutral_calm", () => {
    expect(resolveKiwiVoiceProfile("schedule").profile).toBe("neutral_calm");
  });

  it("bookshelf panel → study_buddy", () => {
    expect(resolveKiwiVoiceProfile("bookshelf").profile).toBe("study_buddy");
  });

  it("notebook panel → study_buddy", () => {
    expect(resolveKiwiVoiceProfile("notebook").profile).toBe("study_buddy");
  });

  it("apps panel → neutral_calm", () => {
    expect(resolveKiwiVoiceProfile("apps").profile).toBe("neutral_calm");
  });

  it("feeling panel → neutral_calm (most subdued for emotional check-in)", () => {
    expect(resolveKiwiVoiceProfile("feeling").profile).toBe("neutral_calm");
  });

  it("stuck panel → study_buddy", () => {
    expect(resolveKiwiVoiceProfile("stuck").profile).toBe("study_buddy");
  });

  it("unknown panel → older_cousin (safe default)", () => {
    const r = resolveKiwiVoiceProfile("settings");
    expect(r.profile).toBe("older_cousin");
    expect(r.rationale).toMatch(/safe default/i);
  });

  it("empty string → older_cousin", () => {
    expect(resolveKiwiVoiceProfile("").profile).toBe("older_cousin");
  });

  it("null → older_cousin", () => {
    expect(resolveKiwiVoiceProfile(null).profile).toBe("older_cousin");
  });

  it("undefined → older_cousin", () => {
    expect(resolveKiwiVoiceProfile(undefined).profile).toBe("older_cousin");
  });

  it("case-insensitive: TODAY → older_cousin", () => {
    expect(resolveKiwiVoiceProfile("TODAY").profile).toBe("older_cousin");
  });

  it("whitespace trimmed: '  schedule  ' → neutral_calm", () => {
    expect(resolveKiwiVoiceProfile("  schedule  ").profile).toBe(
      "neutral_calm",
    );
  });

  it("rationale never contains forbidden voice words", () => {
    for (const panel of listKiwiPanels()) {
      const r = resolveKiwiVoiceProfile(panel);
      expect(r.rationale).not.toMatch(/buddy.*pal|yay|woohoo|great job|awesome|sweetie/i);
    }
  });

  it("rationale never contains exclamation marks (adult-tone rule)", () => {
    for (const panel of listKiwiPanels()) {
      const r = resolveKiwiVoiceProfile(panel);
      expect(r.rationale).not.toContain("!");
    }
  });

  it("listKiwiPanels returns all 8 known surfaces", () => {
    const panels = listKiwiPanels();
    expect(panels).toHaveLength(8);
    expect(panels).toContain("today");
    expect(panels).toContain("feeling");
    expect(panels).toContain("stuck");
  });

  it("is deterministic — same input → same output", () => {
    const a = resolveKiwiVoiceProfile("notebook");
    const b = resolveKiwiVoiceProfile("notebook");
    expect(a).toEqual(b);
  });
});
