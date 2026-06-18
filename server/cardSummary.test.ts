import { describe, it, expect } from "vitest";
import { cardSummary } from "../shared/cardSummary";

describe("cardSummary", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(cardSummary(null)).toBe("");
    expect(cardSummary(undefined)).toBe("");
    expect(cardSummary("")).toBe("");
  });

  it("passes short text through unchanged", () => {
    const s = "A quick fun video clip to start the afternoon.";
    expect(cardSummary(s)).toBe(s);
  });

  it("strips raw http/https URLs", () => {
    const s =
      "Watch this first: https://www.pbs.org/video/what-actually-makes-water-roll-off jg5gme then discuss.";
    const out = cardSummary(s);
    expect(out).not.toMatch(/https?:\/\//);
    expect(out).not.toMatch(/pbs\.org/);
    expect(out.toLowerCase()).toContain("watch this first");
  });

  it("strips www and bare domains", () => {
    const out = cardSummary("Go to www.example.com and also askabiologist.asu.edu/feathers for more.");
    expect(out).not.toMatch(/www\.|example\.com|asu\.edu/);
  });

  it("keeps markdown link labels but drops the URL", () => {
    const out = cardSummary("See the [feather diagram](https://example.org/x) closely.");
    expect(out).toContain("feather diagram");
    expect(out).not.toMatch(/https?:|example\.org/);
  });

  it("removes === SECTION === dividers and markup", () => {
    const out = cardSummary("=== WATCH === Intro paragraph. === SEE IT UP CLOSE === more.");
    expect(out).not.toContain("===");
    expect(out).not.toContain("WATCH");
    expect(out).toContain("Intro paragraph.");
  });

  it("collapses newlines/whitespace into single spaces", () => {
    const out = cardSummary("line one\n\n   line two\tline three");
    expect(out).toBe("line one line two line three");
  });

  it("truncates a long body to <= maxLen and adds an ellipsis when trimmed", () => {
    const long =
      'WHAT WE ARE DOING TODAY: Hydro means WATER. We are learning WHY water rolls off ducks and birds instead of soaking in, then after lunch we test it for real in the Duck Hydro Lab with many many extra words to overflow the card.';
    const out = cardSummary(long, 160);
    expect(out.length).toBeLessThanOrEqual(161); // 160 + ellipsis tolerance
    expect(out.endsWith("…") || /[.!?]$/.test(out)).toBe(true);
  });

  it("handles the real duck wall-of-text without URLs and within length", () => {
    const duck =
      'WHAT WE\'RE DOING TODAY: "Hydro" means WATER. === WATCH (~10 min of video) === 1) PBS Deep Look — "What Actually Makes Water Roll Off a Duck\'s Back?" (~4 min): https://www.pbs.org/video/what-actually-makes-water-roll-off-a-ducks-back-jg5gme/ 2) PBS Kids https://pbskids.org/videos/watch/why-do-birds-have-feathers/1115 === HOW IT CONNECTS === A feather isn\'t one solid piece.';
    const out = cardSummary(duck, 160);
    expect(out).not.toMatch(/https?:\/\//);
    expect(out).not.toMatch(/pbs\.org|pbskids\.org/);
    expect(out).not.toContain("===");
    expect(out.length).toBeLessThanOrEqual(161);
    expect(out.toLowerCase()).toContain("hydro");
  });
});
