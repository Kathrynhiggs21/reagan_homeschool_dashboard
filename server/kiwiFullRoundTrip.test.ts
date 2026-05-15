import { describe, it, expect } from "vitest";
import { runKiwiFullRoundTrip } from "./_lib/kiwiFullRoundTrip";

const TS = 1779000000000;

describe("kiwiFullRoundTrip — end-to-end dry-run", () => {
  it("today + clean candidate: profile=older_cousin, cap=3, severity=info, no actions", () => {
    const r = runKiwiFullRoundTrip({
      panel: "today",
      candidate: "Got it. Open page 47.",
      timestampUtcMs: TS,
    });
    expect(r.preGen.profile).toBe("older_cousin");
    expect(r.preGen.voice.sentenceCap).toBe(3);
    expect(r.audit.severity).toBe("info");
    expect(r.audit.actions).toEqual([]);
    expect(r.postGen.finalText).toBe("Got it. Open page 47.");
  });

  it("today + nickname-only: severity=minor, nickname redacted", () => {
    const r = runKiwiFullRoundTrip({
      panel: "today",
      candidate: "Got it, sweetie. Open page 47.",
      timestampUtcMs: TS,
    });
    expect(r.audit.severity).toBe("minor");
    expect(r.audit.actions[0].kind).toBe("nickname_redact");
    expect(r.postGen.finalText.toLowerCase()).not.toContain("sweetie");
  });

  it("today + 4 sentences: capped to 3 (older_cousin cap)", () => {
    const r = runKiwiFullRoundTrip({
      panel: "today",
      candidate: "One. Two. Three. Four.",
      timestampUtcMs: TS,
    });
    expect(r.postGen.cappedForLength).toBe(true);
    expect(r.audit.severity).toBe("minor");
    expect(r.audit.actions[0].kind).toBe("length_cap");
    expect(r.postGen.finalText).toBe("One. Two. Three.");
  });

  it("bookshelf + 3 sentences: capped to 2 (study_buddy cap)", () => {
    const r = runKiwiFullRoundTrip({
      panel: "bookshelf",
      candidate: "Page 47. Read paragraph 1. Then paragraph 2.",
      timestampUtcMs: TS,
    });
    expect(r.preGen.profile).toBe("study_buddy");
    expect(r.preGen.voice.sentenceCap).toBe(2);
    expect(r.postGen.cappedForLength).toBe(true);
    expect(r.postGen.finalText).toBe("Page 47. Read paragraph 1.");
  });

  it("feeling + 3 sentences: capped to 2 (neutral_calm cap)", () => {
    const r = runKiwiFullRoundTrip({
      panel: "feeling",
      candidate:
        "You seem off today. That's okay. Tell me when you want to talk.",
      timestampUtcMs: TS,
    });
    expect(r.preGen.profile).toBe("neutral_calm");
    expect(r.preGen.voice.sentenceCap).toBe(2);
    expect(r.postGen.cappedForLength).toBe(true);
  });

  it("any panel + drift-flagged: severity=major, fallback used, downstream skipped", () => {
    const r = runKiwiFullRoundTrip({
      panel: "today",
      candidate: "Yay buddy! Great job, kiddo! Awesome!",
      timestampUtcMs: TS,
    });
    expect(r.audit.severity).toBe("major");
    expect(r.postGen.usedFallback).toBe(true);
    expect(r.audit.actions).toHaveLength(1);
    expect(r.audit.actions[0].kind).toBe("drift_fallback");
  });

  it("unknown panel falls through to older_cousin defaults", () => {
    const r = runKiwiFullRoundTrip({
      panel: "marketing",
      candidate: "Got it.",
      timestampUtcMs: TS,
    });
    expect(r.preGen.profile).toBe("older_cousin");
    expect(r.preGen.voice.sentenceCap).toBe(3);
  });

  it("null panel works without throwing", () => {
    const r = runKiwiFullRoundTrip({
      panel: null,
      candidate: "Got it.",
      timestampUtcMs: TS,
    });
    expect(r.preGen.profile).toBe("older_cousin");
  });

  it("non-string candidate coerces to empty", () => {
    const r = runKiwiFullRoundTrip({
      panel: "today",
      candidate: undefined as unknown as string,
      timestampUtcMs: TS,
    });
    expect(r.postGen.finalText).toBe("");
    expect(r.audit.severity).toBe("info");
  });

  it("originalCandidate preserved verbatim in audit", () => {
    const candidate = "Reagan, take a look at page 47.";
    const r = runKiwiFullRoundTrip({
      panel: "today",
      candidate,
      timestampUtcMs: TS,
    });
    expect(r.audit.originalCandidate).toBe(candidate);
    // Reagan's name is allowed — should survive
    expect(r.postGen.finalText).toContain("Reagan");
  });

  it("timestamp passthrough", () => {
    const r = runKiwiFullRoundTrip({
      panel: "today",
      candidate: "Got it.",
      timestampUtcMs: TS + 12345,
    });
    expect(r.audit.timestampUtcMs).toBe(TS + 12345);
  });

  it("audit row carries the final text the user actually saw", () => {
    const r = runKiwiFullRoundTrip({
      panel: "today",
      candidate: "Got it, sweetie. Open page 47.",
      timestampUtcMs: TS,
    });
    expect(r.audit.finalText).toBe(r.postGen.finalText);
  });

  it("schedule panel uses neutral_calm and caps at 2", () => {
    const r = runKiwiFullRoundTrip({
      panel: "schedule",
      candidate: "Math at 9. Reading at 10. Lunch at 12.",
      timestampUtcMs: TS,
    });
    expect(r.preGen.profile).toBe("neutral_calm");
    expect(r.preGen.voice.sentenceCap).toBe(2);
  });

  it("notebook panel uses study_buddy", () => {
    const r = runKiwiFullRoundTrip({
      panel: "notebook",
      candidate: "Got it.",
      timestampUtcMs: TS,
    });
    expect(r.preGen.profile).toBe("study_buddy");
  });

  it("is fully deterministic — same input → same triple", () => {
    const input = {
      panel: "today",
      candidate: "Got it, sweetie. Open page 47. Read paragraph one.",
      timestampUtcMs: TS,
    };
    const a = runKiwiFullRoundTrip(input);
    const b = runKiwiFullRoundTrip(input);
    expect(a).toEqual(b);
  });

  it("non-redact audit summaries never contain forbidden voice words", () => {
    // nickname_redact summaries legitimately name the redacted term
    // (that's the whole point). For OTHER action kinds, summaries
    // must stay clean of forbidden words.
    const candidate = "One. Two. Three. Four. Five. Six.";
    for (const panel of [
      "today",
      "bookshelf",
      "notebook",
      "schedule",
      "apps",
      "feeling",
      "stuck",
      "kiwi",
    ]) {
      const r = runKiwiFullRoundTrip({
        panel,
        candidate,
        timestampUtcMs: TS,
      });
      for (const action of r.audit.actions) {
        if (action.kind === "nickname_redact") continue;
        expect(action.summary).not.toMatch(
          /\b(yay|woohoo|great job|awesome|amazing|buddy|friend|pal|kiddo|sweetie)\b/i,
        );
      }
    }
  });
});
