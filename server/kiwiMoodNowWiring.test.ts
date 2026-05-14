/**
 * Push 146 (2026-05-14) — today.kiwiMoodNow wiring contract.
 *
 * Source-level assertion that the procedure exists, is wired to the
 * pure helper, and exposes the kid-callable shape the Today header
 * chip relies on (poll every 60s).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "routers.ts"), "utf8");

describe("today.kiwiMoodNow", () => {
  it("declares the procedure", () => {
    expect(src).toContain("kiwiMoodNow: publicProcedure");
  });

  it("imports the pure helper from _lib/kiwiMoodTracker", () => {
    expect(src).toContain('import("./_lib/kiwiMoodTracker")');
    expect(src).toContain("readKiwiMoodForBlock");
  });

  it("requires the minimum block context (sortOrder, title, scheduled, elapsed)", () => {
    expect(src).toContain("blockSortOrder: z.number().int().min(1).max(20)");
    expect(src).toContain("blockTitle: z.string().min(1).max(120)");
    expect(src).toContain("scheduledMinutes: z.number().min(1).max(180)");
    expect(src).toContain("elapsedMinutes: z.number().min(0).max(240)");
  });

  it("optional Kiwi signals all fall through to safe defaults", () => {
    expect(src).toContain("micFocusFraction: input.micFocusFraction ?? 0.5");
    expect(src).toContain("micDistressFraction: input.micDistressFraction ?? 0");
    expect(src).toContain("onTaskEvents: input.onTaskEvents ?? 0");
    expect(src).toContain("kidFlaggedHard: input.kidFlaggedHard ?? false");
  });
});
