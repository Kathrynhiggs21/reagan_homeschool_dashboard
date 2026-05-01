import { describe, expect, it } from "vitest";

/**
 * Mirror of the TEST_PATTERNS regex used in client/src/pages/Today.tsx
 * to filter test/quiz/screener/placement-style blocks off Reagan's view.
 *
 * Keep this regex in sync with the one in Today.tsx.
 */
const TEST_PATTERNS = /\b(test|quiz|screener|screening|placement|assessment|benchmark)\b/i;

function shouldHide(b: { title?: string | null; description?: string | null }): boolean {
  return TEST_PATTERNS.test(`${b.title ?? ""} ${b.description ?? ""}`);
}

describe("Today filter — hides test/quiz/screener items", () => {
  it("hides math placement test", () => {
    expect(shouldHide({ title: "Math Placement Test", description: null })).toBe(true);
  });

  it("hides quiz blocks", () => {
    expect(shouldHide({ title: "Reading Quiz", description: null })).toBe(true);
    expect(shouldHide({ title: "spelling QUIZ", description: null })).toBe(true);
  });

  it("hides screener / screening", () => {
    expect(shouldHide({ title: "Diagnostic screener", description: null })).toBe(true);
    expect(shouldHide({ title: "Behavior screening", description: null })).toBe(true);
  });

  it("hides assessment + benchmark", () => {
    expect(shouldHide({ title: "Quarterly Assessment", description: null })).toBe(true);
    expect(shouldHide({ title: "iReady Benchmark", description: null })).toBe(true);
  });

  it("matches in description if not in title", () => {
    expect(shouldHide({ title: "Math practice", description: "Includes a short quiz at the end." })).toBe(true);
  });

  it("does NOT hide regular work that happens to mention 'best' or 'testimony' (no whole-word match)", () => {
    // Word boundaries keep these out of the filter.
    expect(shouldHide({ title: "Quietest moments journal", description: null })).toBe(false);
    expect(shouldHide({ title: "Testimony reading", description: null })).toBe(false);
    expect(shouldHide({ title: "Place the value", description: null })).toBe(false);
  });

  it("does NOT hide normal blocks", () => {
    expect(shouldHide({ title: "Read for 20 minutes", description: "Bookshelf book of choice." })).toBe(false);
    expect(shouldHide({ title: "Math worksheet — fractions", description: null })).toBe(false);
  });
});
