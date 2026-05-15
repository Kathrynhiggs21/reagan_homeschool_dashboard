import { describe, it, expect } from "vitest";
import { runKiwiPostGenPipeline } from "./_lib/kiwiPipelineRunner";

describe("kiwiPipelineRunner — bundled post-gen Kiwi voice guard", () => {
  it("clean short reply passes through untouched", () => {
    const r = runKiwiPostGenPipeline({
      candidate: "Got it. I'll pull up page 47.",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(false);
    expect(r.cappedForLength).toBe(false);
    expect(r.finalText).toContain("page 47");
  });

  it("kiddy-flagged reply substitutes safeFallback (no length cap applied)", () => {
    const r = runKiwiPostGenPipeline({
      candidate: "Yay buddy! Great job, kiddo! Awesome work!",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(true);
    expect(r.cappedForLength).toBe(false);
    expect(r.finalText).toBe(r.drift.safeFallback);
    expect(r.length).toBeNull();
  });

  it("creepy-flagged reply also substitutes safeFallback", () => {
    const r = runKiwiPostGenPipeline({
      candidate: "I'm always here for you~~~ hehehe.....",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(true);
    expect(r.finalText).toBe(r.drift.safeFallback);
  });

  it("long but on-tone reply is length-capped", () => {
    const r = runKiwiPostGenPipeline({
      candidate:
        "Open the page. Read paragraph one. Now write down the answer. Then move to the next. Last task here.",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(false);
    expect(r.cappedForLength).toBe(true);
    expect(r.length?.cappedSentenceCount).toBe(3);
    expect(r.finalText).not.toContain("Last task");
  });

  it("respects maxSentences=1", () => {
    const r = runKiwiPostGenPipeline({
      candidate: "First. Second. Third.",
      maxSentences: 1,
    });
    expect(r.usedFallback).toBe(false);
    expect(r.finalText).toBe("First.");
  });

  it("maxSentences defaults to 3 when 0/negative is given", () => {
    const r = runKiwiPostGenPipeline({
      candidate: "One. Two. Three. Four. Five.",
      maxSentences: 0,
    });
    expect(r.finalText).toBe("One. Two. Three.");
    expect(r.length?.cappedSentenceCount).toBe(3);
  });

  it("safeFallback never contains forbidden voice words", () => {
    const r = runKiwiPostGenPipeline({
      candidate: "Yay buddy!",
      maxSentences: 3,
    });
    expect(r.finalText).not.toMatch(/buddy|friend|yay|woohoo|great job|awesome/i);
  });

  it("drift diagnostics always surfaced even on a clean reply", () => {
    const r = runKiwiPostGenPipeline({
      candidate: "Got it.",
      maxSentences: 3,
    });
    expect(r.drift).toBeDefined();
    expect(r.drift.driftScore).toBe(0);
    expect(r.drift.flagged).toBe(false);
  });

  it("is deterministic — same input → same output", () => {
    const a = runKiwiPostGenPipeline({
      candidate: "One. Two. Three. Four.",
      maxSentences: 2,
    });
    const b = runKiwiPostGenPipeline({
      candidate: "One. Two. Three. Four.",
      maxSentences: 2,
    });
    expect(a).toEqual(b);
  });

  it("handles empty candidate without throwing", () => {
    const r = runKiwiPostGenPipeline({ candidate: "", maxSentences: 3 });
    expect(r.usedFallback).toBe(false);
    expect(r.finalText).toBe("");
  });

  it("handles non-string candidate without throwing", () => {
    const r = runKiwiPostGenPipeline({
      candidate: undefined as unknown as string,
      maxSentences: 3,
    });
    expect(r.finalText).toBe("");
  });

  it("drift cleaning is applied BEFORE length capping", () => {
    // The candidate has extra ! marks (low score = won't flag at 1 instance
    // but multi instances will). Use 2x "!" = score 0 so it passes drift
    // but the cleanedPreview should collapse !! -> !
    const r = runKiwiPostGenPipeline({
      candidate: "Got it!! Working on it!!",
      maxSentences: 3,
    });
    // Won't be flagged (need 3+ "!" total).
    expect(r.usedFallback).toBe(false);
    expect(r.finalText).not.toContain("!!");
  });

  it("when fallback fires, length object is null and cappedForLength is false", () => {
    const r = runKiwiPostGenPipeline({
      candidate: "Yay great job amazing!",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(true);
    expect(r.length).toBeNull();
    expect(r.cappedForLength).toBe(false);
  });

  it("ALL CAPS reply triggers drift, not length cap", () => {
    const r = runKiwiPostGenPipeline({
      candidate: "PLEASE FINISH THIS NOW BEFORE LUNCH",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(true);
  });

  it("'You must finish' (imperative-punitive) → fallback fires", () => {
    const r = runKiwiPostGenPipeline({
      candidate: "You must finish this before lunch. You have to.",
      maxSentences: 3,
    });
    expect(r.usedFallback).toBe(true);
  });
});
