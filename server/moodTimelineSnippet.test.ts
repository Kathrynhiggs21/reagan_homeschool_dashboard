/**
 * Push 102 (2026-05-13) — Mood timeline click-to-snippet contract.
 *
 * Locks the privacy + visibility rules so MoodTimelineStrip never
 * leaks Reagan's transcript to the wrong viewer.
 */
import { describe, it, expect } from "vitest";
import { resolveMoodTimelineSnippet } from "./_lib/moodTimelineSnippet";

describe("Push 102 — mood timeline click-to-snippet privacy", () => {
  const baseSnippet = "Reagan: I think the answer is 42.";

  it("kid (Reagan herself) is NEVER allowed to see her own transcript", () => {
    const r = resolveMoodTimelineSnippet({
      transcriptSnippet: baseSnippet,
      reaganVoicePresent: true,
      viewer: "kid",
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("kid-not-allowed");
  });

  it("Mom always sees the snippet when one exists", () => {
    const r = resolveMoodTimelineSnippet({
      transcriptSnippet: baseSnippet,
      reaganVoicePresent: false,
      viewer: "mom",
    });
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.snippet).toBe(baseSnippet);
  });

  it("Grandma always sees the snippet when one exists", () => {
    const r = resolveMoodTimelineSnippet({
      transcriptSnippet: baseSnippet,
      reaganVoicePresent: false,
      viewer: "grandma",
    });
    expect(r.allowed).toBe(true);
  });

  it("Tutor only sees snippet when Reagan's voice was confirmed in the chunk", () => {
    const withVoice = resolveMoodTimelineSnippet({
      transcriptSnippet: baseSnippet,
      reaganVoicePresent: true,
      viewer: "tutor",
    });
    expect(withVoice.allowed).toBe(true);

    const withoutVoice = resolveMoodTimelineSnippet({
      transcriptSnippet: baseSnippet,
      reaganVoicePresent: false,
      viewer: "tutor",
    });
    expect(withoutVoice.allowed).toBe(false);
    if (!withoutVoice.allowed) expect(withoutVoice.reason).toBe("tutor-needs-voice");
  });

  it("privacy-flagged chunks are hidden from every adult viewer", () => {
    for (const viewer of ["mom", "grandma", "tutor"] as const) {
      const r = resolveMoodTimelineSnippet({
        transcriptSnippet: baseSnippet,
        reaganVoicePresent: true,
        privateFlagged: true,
        viewer,
      });
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe("privacy-flagged");
    }
  });

  it("empty/whitespace snippet returns no-snippet (not allowed)", () => {
    for (const snippet of [null, undefined, "", "   ", "\n\t"]) {
      const r = resolveMoodTimelineSnippet({
        transcriptSnippet: snippet as any,
        reaganVoicePresent: true,
        viewer: "mom",
      });
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe("no-snippet");
    }
  });

  it("returned snippet is trimmed", () => {
    const r = resolveMoodTimelineSnippet({
      transcriptSnippet: "   Reagan said hi.   \n",
      viewer: "grandma",
    });
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.snippet).toBe("Reagan said hi.");
  });

  it("kid-not-allowed beats all other reasons (privacy takes precedence over content)", () => {
    // Even with no snippet, kid should still get kid-not-allowed.
    const r = resolveMoodTimelineSnippet({
      transcriptSnippet: "",
      viewer: "kid",
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("kid-not-allowed");
  });
});
