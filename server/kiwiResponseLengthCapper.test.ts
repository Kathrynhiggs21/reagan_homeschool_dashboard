import { describe, it, expect } from "vitest";
import { capKiwiResponseLength } from "./_lib/kiwiResponseLengthCapper";

describe("kiwiResponseLengthCapper — Reagan short-reply guard", () => {
  it("returns input unchanged when sentence count is below the cap", () => {
    const r = capKiwiResponseLength("Got it. I'll pull it up.", 3);
    expect(r.capped).toBe(false);
    expect(r.originalSentenceCount).toBe(2);
    expect(r.cappedSentenceCount).toBe(2);
    expect(r.text).toContain("Got it");
    expect(r.text).toContain("pull it up");
  });

  it("truncates to N sentences when over the cap", () => {
    const r = capKiwiResponseLength(
      "Open the page. Read paragraph one. Now answer the question. Then move on. Last thing.",
      3,
    );
    expect(r.capped).toBe(true);
    expect(r.cappedSentenceCount).toBe(3);
    expect(r.originalSentenceCount).toBe(5);
    expect(r.text).toContain("Open the page");
    expect(r.text).toContain("answer the question");
    expect(r.text).not.toContain("Last thing");
  });

  it("never chops mid-word (cuts at sentence boundary)", () => {
    const r = capKiwiResponseLength(
      "Hello there. This is sentence two with extra words. Sentence three keeps going.",
      1,
    );
    expect(r.text).toBe("Hello there.");
  });

  it("keeps the whole input when there are no detectable sentence breaks", () => {
    const r = capKiwiResponseLength("just a single run-on without punctuation", 2);
    expect(r.capped).toBe(false);
    expect(r.text).toBe("just a single run-on without punctuation");
  });

  it("strips emoji (defense-in-depth against the voice guard)", () => {
    const r = capKiwiResponseLength("Got it 🎉. Pull up the page 📖.", 3);
    expect(r.text).not.toContain("🎉");
    expect(r.text).not.toContain("📖");
  });

  it("collapses runs of 3+ spaces and trims trailing spaces before punctuation", () => {
    const r = capKiwiResponseLength("Got it   .   Pull it up.", 3);
    expect(r.text).not.toMatch(/\s{3,}/);
    expect(r.text).toContain("Got it.");
  });

  it("preserves the terminating punctuation of each kept sentence", () => {
    const r = capKiwiResponseLength("Hi. How are you? I'm fine!", 2);
    expect(r.text).toBe("Hi. How are you?");
  });

  it("handles cap=1 (single-sentence floor honored)", () => {
    const r = capKiwiResponseLength("One. Two. Three.", 1);
    expect(r.cappedSentenceCount).toBe(1);
    expect(r.text).toBe("One.");
  });

  it("treats fractional caps as floor (max 2.7 → 2)", () => {
    const r = capKiwiResponseLength("One. Two. Three.", 2.7);
    expect(r.cappedSentenceCount).toBe(2);
  });

  it("treats cap <= 0 as cap=1 (floor)", () => {
    const r = capKiwiResponseLength("One. Two.", 0);
    expect(r.cappedSentenceCount).toBe(1);
  });

  it("handles empty input without throwing", () => {
    const r = capKiwiResponseLength("", 3);
    expect(r.text).toBe("");
    expect(r.capped).toBe(false);
  });

  it("handles non-string input without throwing", () => {
    const r = capKiwiResponseLength(undefined as unknown as string, 3);
    expect(r.text).toBe("");
  });

  it("does NOT pad short replies", () => {
    const r = capKiwiResponseLength("Hi.", 5);
    expect(r.text).toBe("Hi.");
    expect(r.capped).toBe(false);
  });

  it("is deterministic — same input twice → same output", () => {
    const a = capKiwiResponseLength("One. Two. Three. Four.", 2);
    const b = capKiwiResponseLength("One. Two. Three. Four.", 2);
    expect(a).toEqual(b);
  });

  it("recognizes a leading quote as a sentence start", () => {
    // The splitter must NOT treat the quoted sentence as part of the first.
    const r = capKiwiResponseLength(
      'I told her. "She said no." Then we moved on.',
      1,
    );
    // With cap=1, only sentence 1 should survive.
    expect(r.text).toBe('I told her.');
  });

  it("originalSentenceCount reflects the full pre-cap count", () => {
    const r = capKiwiResponseLength("A. B. C. D. E.", 2);
    expect(r.originalSentenceCount).toBe(5);
    expect(r.cappedSentenceCount).toBe(2);
  });
});
