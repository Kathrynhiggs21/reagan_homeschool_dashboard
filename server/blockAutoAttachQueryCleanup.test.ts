/**
 * blockAutoAttachQueryCleanup.test.ts — v2.93 (2026-05-27)
 *
 * Locks the bare-block-bug fix in `buildFinderQueryForBlock`. Symptoms:
 *   - Block titled "✏️ Math 10-2 — Make Line Plots" returned 0 finder results
 *     because the cleanup didn't strip the leading emoji + curriculum-code
 *     prefix ("Math 10-2"). Library LIKE matching + Sonar both anchored on
 *     "10-2" instead of "Make Line Plots".
 *
 * Contract:
 *   1. Strips leading pictograph blocks (✏️ 📐 📕 …)
 *   2. Strips leading curriculum-code prefixes ("Math 10-2 —", "ELA M4-L1 —",
 *      "SS 4-2 —") and keeps the searchable phrase
 *   3. Recovers a subject keyword from `subjectSlug` (or the stripped prefix)
 *      and prepends it so the query stays anchored
 *   4. Leaves untagged titles ("Slow morning", "Choice block") unchanged
 *      (other than whitespace squashing)
 *   5. Idempotent — re-running cleanup on already-cleaned text is a no-op
 *      for the canonical academic-block titles
 */
import { describe, it, expect } from "vitest";
import { buildFinderQueryForBlock } from "./_lib/blockAutoAttach";

describe("buildFinderQueryForBlock — v2.93 query cleanup", () => {
  it("strips leading pictograph + curriculum code, keeps searchable phrase + subject hint", () => {
    expect(
      buildFinderQueryForBlock({
        id: 1,
        title: "✏️ Math 10-2 — Make Line Plots",
        subjectSlug: "math",
        blockType: "math",
      }),
    ).toBe("Math Make Line Plots");
  });

  it("handles ELA M4-L1 prefix", () => {
    expect(
      buildFinderQueryForBlock({
        id: 2,
        title: "✏️ ELA M4-L1 — Use context to determine word meaning",
        subjectSlug: "ela",
        blockType: "read_aloud",
      }),
    ).toBe("ELA Use context to determine word meaning");
  });

  it("handles SS code prefix even when subjectSlug is null", () => {
    expect(
      buildFinderQueryForBlock({
        id: 3,
        title: "✏️ SS 4-2 — Scarcity, trade, and economic choices",
        subjectSlug: null,
        blockType: "custom",
      }),
    ).toBe("SS Scarcity, trade, and economic choices");
  });

  it("recovers Math subject hint from subjectSlug when no code prefix", () => {
    expect(
      buildFinderQueryForBlock({
        id: 4,
        title: "Make Line Plots",
        subjectSlug: "math",
        blockType: "math",
      }),
    ).toBe("Math Make Line Plots");
  });

  it("does NOT double-prepend when subject already in title", () => {
    expect(
      buildFinderQueryForBlock({
        id: 5,
        title: "Math fluency drill",
        subjectSlug: "math",
        blockType: "math",
      }),
    ).toBe("Math fluency drill");
  });

  it("leaves a non-academic block alone", () => {
    expect(
      buildFinderQueryForBlock({
        id: 6,
        title: "Slow morning",
        subjectSlug: null,
        blockType: "morning_warmup",
      }),
    ).toBe("Slow morning");
  });

  it("strips house-syntax prefixes after the cleanup", () => {
    expect(
      buildFinderQueryForBlock({
        id: 7,
        title: "Custom worksheet: long division practice",
        subjectSlug: "math",
        blockType: "math",
      }),
    ).toBe("Math long division practice");
  });

  it("handles 'Read aloud:' prefix and reading subject", () => {
    expect(
      buildFinderQueryForBlock({
        id: 8,
        title: "Read aloud: Tuck Everlasting Chapter 6",
        subjectSlug: "reading",
        blockType: "read_aloud",
      }),
    ).toBe("Reading Tuck Everlasting Chapter 6");
  });

  it("collapses repeated whitespace", () => {
    expect(
      buildFinderQueryForBlock({
        id: 9,
        title: "📐  Math   10-1  —   Analyze   Line   Plots",
        subjectSlug: "math",
        blockType: "math",
      }),
    ).toBe("Math Analyze Line Plots");
  });

  it("returns empty string for null/empty title", () => {
    expect(
      buildFinderQueryForBlock({ id: 10, title: null }),
    ).toBe("");
    expect(
      buildFinderQueryForBlock({ id: 11, title: "" }),
    ).toBe("");
  });

  it("is idempotent on already-cleaned canonical output", () => {
    const cleaned = "Math Make Line Plots";
    expect(
      buildFinderQueryForBlock({
        id: 12,
        title: cleaned,
        subjectSlug: "math",
        blockType: "math",
      }),
    ).toBe(cleaned);
  });
});
