import { describe, it, expect } from "vitest";
import { runKiwiFullPostGenPipeline } from "./_lib/kiwiFullPostGenPipeline";

describe("kiwiFullPostGenPipeline — drift → nickname → length", () => {
  it("clean reply: no fallback, no nickname clean, no length cap", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: "Got it. I'll pull up page 47.",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(false);
    expect(r.nicknameCleaned).toBe(false);
    expect(r.cappedForLength).toBe(false);
    expect(r.finalText).toContain("page 47");
  });

  it("nickname-only reply: nicknameCleaned=true, drift=false", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: "Sure thing, sweetie. Open page 47.",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(false);
    expect(r.nicknameCleaned).toBe(true);
    expect(r.finalText.toLowerCase()).not.toContain("sweetie");
    expect(r.finalText).toContain("page 47");
  });

  it("drift-flagged reply: fallback fires, nicknames and length skipped", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: "Yay buddy! Great job, kiddo! Awesome work!",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(true);
    expect(r.nicknames).toBeNull();
    expect(r.length).toBeNull();
  });

  it("long but clean reply gets length-capped", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate:
        "Open the page. Read paragraph one. Now write the answer. Next task. Last task.",
      maxSentences: 3,
    });
    expect(r.cappedForLength).toBe(true);
    expect(r.finalText).not.toContain("Last task");
  });

  it("long reply with nicknames: both cleaned and capped", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate:
        "Sure, sweetie. Open the page. Read paragraph one. Write the answer. Last task.",
      maxSentences: 3,
    });
    expect(r.nicknameCleaned).toBe(true);
    expect(r.cappedForLength).toBe(true);
    expect(r.finalText.toLowerCase()).not.toContain("sweetie");
    expect(r.finalText).not.toContain("Last task");
  });

  it("maxSentences defaults to 3 when 0 or negative", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: "One. Two. Three. Four. Five.",
      maxSentences: 0,
    });
    expect(r.finalText).toBe("One. Two. Three.");
    expect(r.length?.cappedSentenceCount).toBe(3);
  });

  it("respects maxSentences=1", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: "First. Second. Third.",
      maxSentences: 1,
    });
    expect(r.finalText).toBe("First.");
  });

  it("diagnostics surfaced from every step (clean path)", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: "Got it.",
      maxSentences: 3,
    });
    expect(r.drift).toBeDefined();
    expect(r.nicknames).toBeDefined();
    expect(r.length).toBeDefined();
  });

  it("is deterministic — same input → same output", () => {
    const a = runKiwiFullPostGenPipeline({
      candidate: "Sure thing, champ. Open page 47.",
      maxSentences: 3,
    });
    const b = runKiwiFullPostGenPipeline({
      candidate: "Sure thing, champ. Open page 47.",
      maxSentences: 3,
    });
    expect(a).toEqual(b);
  });

  it("empty candidate doesn't throw", () => {
    const r = runKiwiFullPostGenPipeline({ candidate: "", maxSentences: 3 });
    expect(r.usedFallback).toBe(false);
    expect(r.finalText).toBe("");
  });

  it("non-string candidate doesn't throw", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: undefined as unknown as string,
      maxSentences: 3,
    });
    expect(r.finalText).toBe("");
  });

  it("nickname guard runs BEFORE length cap (a vocative removed in sentence 1 doesn't push sentence 2 out of the cap)", () => {
    // 3 sentences. Sentence 1 has a vocative we'll redact.
    // After redaction we should still have all 3 sentences with maxSentences=3.
    const r = runKiwiFullPostGenPipeline({
      candidate: "Got it, sweetie. Open page 47. Read paragraph one.",
      maxSentences: 3,
    });
    expect(r.nicknameCleaned).toBe(true);
    expect(r.cappedForLength).toBe(false);
    expect(r.finalText).toContain("paragraph one");
  });

  it("falls back when ALL CAPS triggers drift even with no nicknames", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: "FINISH THIS BEFORE LUNCH",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(true);
  });

  it("falls back when imperative-punitive triggers drift", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: "You must finish this. You have to.",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(true);
  });

  it("safeFallback never contains forbidden voice words even when fallback fires", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: "Yay great job amazing!",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(true);
    expect(r.finalText).not.toMatch(/buddy|friend|yay|woohoo|great job|awesome/i);
  });

  it("Reagan's name is preserved (never redacted as a nickname)", () => {
    const r = runKiwiFullPostGenPipeline({
      candidate: "Reagan, take a look at page 47.",
      maxSentences: 3,
    });
    expect(r.finalText).toContain("Reagan");
  });
});
