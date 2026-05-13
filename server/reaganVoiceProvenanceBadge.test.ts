/**
 * Push 100 (2026-05-13) — Reagan-voice provenance badge contract.
 *
 * Locks the two-tier badge logic so the Actual-vs-Planned strip never
 * shows a "verified" mic icon on a row that isn't actually verified.
 */
import { describe, it, expect } from "vitest";
import {
  reaganVoiceProvenanceBadge,
  SCHOOL_CONTENT_CLASSIFIERS,
} from "./_lib/reaganVoiceProvenanceBadge";

describe("Push 100 — Reagan-voice provenance badge", () => {
  it("verified badge when source=kiwi + voice present + school classifier", () => {
    for (const cls of SCHOOL_CONTENT_CLASSIFIERS) {
      const b = reaganVoiceProvenanceBadge({
        source: "kiwi-listened",
        reaganVoicePresent: true,
        contentClassifier: cls,
      });
      expect(b).not.toBeNull();
      expect(b!.kind).toBe("verified");
      expect(b!.tooltip).toMatch(/counts toward coverage/i);
    }
  });

  it("voice-only badge when source=kiwi + voice present but non-school classifier", () => {
    for (const cls of ["off-topic", "tv", "silence"] as const) {
      const b = reaganVoiceProvenanceBadge({
        source: "kiwi-listened",
        reaganVoicePresent: true,
        contentClassifier: cls,
      });
      expect(b).not.toBeNull();
      expect(b!.kind).toBe("voice-only");
      expect(b!.tooltip).toMatch(/does NOT count toward coverage/i);
    }
  });

  it("voice-only when classifier is missing but voice was present", () => {
    const b = reaganVoiceProvenanceBadge({
      source: "kiwi-listened",
      reaganVoicePresent: true,
    });
    expect(b).not.toBeNull();
    expect(b!.kind).toBe("voice-only");
  });

  it("no badge when source=kiwi but voice NOT present", () => {
    expect(
      reaganVoiceProvenanceBadge({
        source: "kiwi-listened",
        reaganVoicePresent: false,
        contentClassifier: "lesson",
      }),
    ).toBeNull();
  });

  it("no badge for non-kiwi sources even with voice flag set true (defense)", () => {
    for (const src of ["mom", "grandma", "tutor", "reagan-checkin", "auto-derived"] as const) {
      const b = reaganVoiceProvenanceBadge({
        source: src,
        reaganVoicePresent: true,
        contentClassifier: "lesson",
      });
      expect(b).toBeNull();
    }
  });

  it("SCHOOL_CONTENT_CLASSIFIERS matches the slice 4.5 contract list", () => {
    expect([...SCHOOL_CONTENT_CLASSIFIERS]).toEqual([
      "lesson",
      "reading-aloud",
      "problem-solving",
      "discussion-on-topic",
      "adult-led-school-activity",
    ]);
  });

  it("verified tooltip mentions Reagan's voice + school content", () => {
    const b = reaganVoiceProvenanceBadge({
      source: "kiwi-listened",
      reaganVoicePresent: true,
      contentClassifier: "reading-aloud",
    });
    expect(b!.tooltip).toMatch(/Reagan/);
    expect(b!.tooltip).toMatch(/school content/i);
  });
});
