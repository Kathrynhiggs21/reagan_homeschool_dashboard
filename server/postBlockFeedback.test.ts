import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Push 50 (2026-05-13) — Post-block feedback chips dialog.
 *
 * Verifies the Today page hooks FeedbackChips into the Reagan-self-
 * complete success path (NOT the adult grading path), and that the
 * mutation surface still routes to `feedback.record` with all four
 * dimensions (feltIt, whatHelped, timeFelt, wantedBreak).
 */
describe("Today post-block feedback chips (Push 50)", () => {
  const todaySrc = readFileSync(
    resolve(__dirname, "..", "client", "src", "pages", "Today.tsx"),
    "utf8",
  );
  const chipsSrc = readFileSync(
    resolve(__dirname, "..", "client", "src", "components", "FeedbackChips.tsx"),
    "utf8",
  );
  const routerSrc = readFileSync(
    resolve(__dirname, "routers.ts"),
    "utf8",
  );

  it("imports FeedbackChips and tracks feedbackForBlockId state", () => {
    expect(todaySrc).toMatch(/import FeedbackChips from "@\/components\/FeedbackChips"/);
    expect(todaySrc).toMatch(/feedbackForBlockId,\s*setFeedbackForBlockId/);
  });

  it("only Reagan (NOT adult) triggers feedback dialog after complete", () => {
    // Bypass header comments — anchor to the actual onSuccess setter call
    expect(todaySrc).toMatch(/if \(!unlocked\) setFeedbackForBlockId\(b\.id\)/);
  });

  it("renders a Dialog gated on feedbackForBlockId !== null", () => {
    expect(todaySrc).toMatch(/feedbackForBlockId !== null/);
    expect(todaySrc).toMatch(/<FeedbackChips/);
  });

  it("FeedbackChips captures all four dimensions on each chip tap", () => {
    expect(chipsSrc).toMatch(/feltIt:\s*felt\s*\?\?\s*undefined/);
    expect(chipsSrc).toMatch(/whatHelped:\s*what\s*\?\?\s*undefined/);
    expect(chipsSrc).toMatch(/timeFelt:\s*time\s*\?\?\s*undefined/);
    expect(chipsSrc).toMatch(/wantedBreak:\s*wantBreak/);
  });

  it("server feedback.record proc accepts the same enums", () => {
    expect(routerSrc).toMatch(/feedback:\s*router\(/);
    expect(routerSrc).toMatch(/feltIt:\s*z\.enum\(\["easy",\s*"ok",\s*"hard",\s*"skip"\]\)/);
    expect(routerSrc).toMatch(/whatHelped:\s*z\.enum\(\[/);
    expect(routerSrc).toMatch(/wantedBreak:\s*z\.boolean\(\)\.optional\(\)/);
  });
});
