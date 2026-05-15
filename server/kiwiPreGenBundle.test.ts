import { describe, it, expect } from "vitest";
import { buildKiwiPreGenBundle } from "./_lib/kiwiPreGenBundle";

describe("kiwiPreGenBundle — one-call pre-LLM", () => {
  it("today panel: older_cousin profile, sentenceCap=3", () => {
    const b = buildKiwiPreGenBundle({ panel: "today" });
    expect(b.profile).toBe("older_cousin");
    expect(b.voice.sentenceCap).toBe(3);
    expect(b.voice.profile).toBe("older_cousin");
  });

  it("bookshelf panel: study_buddy profile, sentenceCap=2", () => {
    const b = buildKiwiPreGenBundle({ panel: "bookshelf" });
    expect(b.profile).toBe("study_buddy");
    expect(b.voice.sentenceCap).toBe(2);
  });

  it("feeling panel: neutral_calm profile, sentenceCap=2", () => {
    const b = buildKiwiPreGenBundle({ panel: "feeling" });
    expect(b.profile).toBe("neutral_calm");
    expect(b.voice.sentenceCap).toBe(2);
  });

  it("rationale surfaced from resolver", () => {
    const b = buildKiwiPreGenBundle({ panel: "today" });
    expect(b.rationale).toMatch(/older[ -]cousin/i);
  });

  it("voice.systemPromptFragment is non-empty and references the profile", () => {
    const b = buildKiwiPreGenBundle({ panel: "today" });
    expect(b.voice.systemPromptFragment.length).toBeGreaterThan(20);
    expect(b.voice.systemPromptFragment.toLowerCase()).toMatch(/kiwi/);
  });

  it("voice.forbiddenWords includes 'sweetie' across all panels", () => {
    for (const panel of ["today", "bookshelf", "feeling", "schedule"]) {
      const b = buildKiwiPreGenBundle({ panel });
      expect(b.voice.forbiddenWords).toContain("sweetie");
    }
  });

  it("voice.emojiAllowed always false", () => {
    for (const panel of ["today", "bookshelf", "feeling", "schedule", "apps"]) {
      const b = buildKiwiPreGenBundle({ panel });
      expect(b.voice.emojiAllowed).toBe(false);
    }
  });

  it("voice.identityPhrase is 'I'm Kiwi.' across all panels", () => {
    for (const panel of ["today", "bookshelf", "feeling"]) {
      const b = buildKiwiPreGenBundle({ panel });
      expect(b.voice.identityPhrase).toBe("I'm Kiwi.");
    }
  });

  it("readAloudPacing rate is always <= 1.0 (no chirpy default)", () => {
    for (const panel of ["today", "bookshelf", "feeling", "schedule"]) {
      const b = buildKiwiPreGenBundle({ panel });
      expect(b.readAloudPacing.rate).toBeLessThanOrEqual(1.0);
    }
  });

  it("readAloudPacing pitch is always <= 1.0 (no chirpy default)", () => {
    for (const panel of ["today", "bookshelf", "feeling", "schedule"]) {
      const b = buildKiwiPreGenBundle({ panel });
      expect(b.readAloudPacing.pitch).toBeLessThanOrEqual(1.0);
    }
  });

  it("readAloudPacing pauseAfterPeriodMs always >= 250", () => {
    for (const panel of ["today", "bookshelf", "feeling", "schedule"]) {
      const b = buildKiwiPreGenBundle({ panel });
      expect(b.readAloudPacing.pauseAfterPeriodMs).toBeGreaterThanOrEqual(250);
    }
  });

  it("unknown panel → older_cousin safe default", () => {
    const b = buildKiwiPreGenBundle({ panel: "marketing" });
    expect(b.profile).toBe("older_cousin");
  });

  it("null panel → older_cousin", () => {
    const b = buildKiwiPreGenBundle({ panel: null });
    expect(b.profile).toBe("older_cousin");
  });

  it("undefined panel → older_cousin", () => {
    const b = buildKiwiPreGenBundle({ panel: undefined });
    expect(b.profile).toBe("older_cousin");
  });

  it("non-string panel coerces to empty → older_cousin", () => {
    const b = buildKiwiPreGenBundle({
      panel: 42 as unknown as string,
    });
    expect(b.panel).toBe("");
    expect(b.profile).toBe("older_cousin");
  });

  it("is deterministic — same panel → same bundle", () => {
    const a = buildKiwiPreGenBundle({ panel: "notebook" });
    const b = buildKiwiPreGenBundle({ panel: "notebook" });
    expect(a).toEqual(b);
  });

  it("bundle carries the panel back so the audit log can show it", () => {
    expect(buildKiwiPreGenBundle({ panel: "today" }).panel).toBe("today");
    expect(buildKiwiPreGenBundle({ panel: "Bookshelf" }).panel).toBe(
      "Bookshelf",
    );
  });
});
