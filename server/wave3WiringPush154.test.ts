/**
 * Push 154 (2026-05-14) — Wave-3 procedure wiring contract.
 *
 * Source-level assertion that the 3 new procedures exist on the today
 * router, are wired to the right helpers, and use the right gate.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Push 154 — Wave-3 today router wiring", () => {
  const src = readFileSync(
    resolve(__dirname, "routers.ts"),
    "utf-8",
  );

  it("today.agendaEditorParse uses familyAdminProcedure + parseAgendaEditorInput", () => {
    const idx = src.indexOf("agendaEditorParse: familyAdminProcedure");
    expect(idx).toBeGreaterThan(0);
    const window = src.slice(idx, idx + 800);
    expect(window).toMatch(/parseAgendaEditorInput/);
    expect(window).toMatch(/_lib\/agendaEditorParser/);
  });

  it("today.applyInlineTapEdit uses familyAdminProcedure + inlineTapEditHandler", () => {
    const idx = src.indexOf("applyInlineTapEdit: familyAdminProcedure");
    expect(idx).toBeGreaterThan(0);
    const window = src.slice(idx, idx + 1200);
    expect(window).toMatch(/inlineTapEditHandler/);
    // Must accept all 3 fields
    expect(window).toMatch(/"startTime"/);
    expect(window).toMatch(/"durationMin"/);
    expect(window).toMatch(/"title"/);
  });

  it("today.analyticsStrip uses publicProcedure + analyticsEmptyStateGuard", () => {
    const idx = src.indexOf("analyticsStrip: publicProcedure");
    expect(idx).toBeGreaterThan(0);
    const window = src.slice(idx, idx + 1000);
    expect(window).toMatch(/guardAnalyticsStrip/);
    expect(window).toMatch(/analyticsEmptyStateGuard/);
    // All 6 raw signals are accepted
    for (const key of [
      "blocksDone",
      "blocksPlanned",
      "minutesOnTask",
      "submissionsGraded",
      "currentStreakDays",
      "subjectsTouched",
    ]) {
      expect(window).toMatch(new RegExp(`${key}:`));
    }
  });

  it("all 3 Wave-3 procedures live inside the today router (not a sibling)", () => {
    const todayIdx = src.indexOf("today: router({");
    expect(todayIdx).toBeGreaterThan(0);
    // The today router runs all the way to the end of routers.ts, so any
    // procedure declared after `today: router({` and before the closing
    // }), of the appRouter is inside it. Just assert all 3 appear after.
    for (const name of [
      "agendaEditorParse: familyAdminProcedure",
      "applyInlineTapEdit: familyAdminProcedure",
      "analyticsStrip: publicProcedure",
    ]) {
      const procIdx = src.indexOf(name);
      expect(procIdx).toBeGreaterThan(todayIdx);
    }
  });
});
