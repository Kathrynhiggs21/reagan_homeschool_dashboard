import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Push 174 (2026-05-15 Wave-12) — wiring contract for today.moodTimelineRollup.
 *
 * Source-level test: confirms the procedure is registered, on the today
 * router, public-callable, and lazily imports the helper.
 */
const ROUTERS = readFileSync(
  join(__dirname, "routers.ts"),
  "utf8",
);

describe("Push 174 — today.moodTimelineRollup wiring", () => {
  it("declares moodTimelineRollup as a publicProcedure", () => {
    expect(ROUTERS).toMatch(/moodTimelineRollup:\s*publicProcedure/);
  });

  it("validates ISO + chunks shape via zod", () => {
    expect(ROUTERS).toMatch(/dateISO:\s*z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
    expect(ROUTERS).toMatch(/reaganVoicePresent:\s*z\.boolean\(\)/);
    expect(ROUTERS).toMatch(/behaviorTags:\s*z\.array\(z\.string\(\)\)/);
  });

  it("lazily imports the rollup helper", () => {
    expect(ROUTERS).toMatch(
      /await\s+import\(\s*[\s\S]{1,40}listeningMoodTimelineRollup/,
    );
    expect(ROUTERS).toMatch(/rollupListeningMoodTimeline/);
  });

  it("is registered as a query (not mutation)", () => {
    // The whole block contains '.query(' soon after the input.
    const slice = ROUTERS.slice(ROUTERS.indexOf("moodTimelineRollup:"));
    expect(slice.slice(0, 1500)).toMatch(/\.query\(/);
  });
});
