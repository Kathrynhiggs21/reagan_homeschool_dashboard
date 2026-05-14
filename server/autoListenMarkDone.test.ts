/**
 * Push 149 (2026-05-14) — autoListenMarkDone vitest contract.
 */
import { describe, it, expect } from "vitest";
import { decideAutoListenMarkDone } from "./_lib/autoListenMarkDone";

const base = {
  blockSortOrder: 1,
  blockTitle: "Math",
  subjectName: "Math",
  kind: "academic" as const,
  scheduledMinutes: 30,
};

describe("decideAutoListenMarkDone", () => {
  it("auto-completes when duration met + sustained focus", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      elapsedMinutes: 31,
      micFocusFraction: 0.7,
      micDistressFraction: 0,
      onTaskEvents: 8,
    });
    expect(r.decision).toBe("auto_done");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    expect(r.reason).toContain("30 minutes");
  });

  it("auto-completes WITH NOTE on partial focus", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      elapsedMinutes: 30,
      micFocusFraction: 0.45,
      micDistressFraction: 0,
      onTaskEvents: 2,
    });
    expect(r.decision).toBe("auto_done_with_short_note");
    expect(r.shortNote).toBeTruthy();
  });

  it("needs human when duration met but no focus signal", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      elapsedMinutes: 35,
      micFocusFraction: 0.1,
      micDistressFraction: 0,
      onTaskEvents: 0,
    });
    expect(r.decision).toBe("needs_human");
  });

  it("keeps in_progress when duration not yet met", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      elapsedMinutes: 12,
      micFocusFraction: 0.8,
      onTaskEvents: 5,
    });
    expect(r.decision).toBe("keep_in_progress");
  });

  it("never auto-dones a kid-flagged-hard block", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      elapsedMinutes: 60,
      micFocusFraction: 1,
      onTaskEvents: 50,
      kidFlaggedHard: true,
    });
    expect(r.decision).toBe("needs_human");
  });

  it("never auto-dones a locked block", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      elapsedMinutes: 60,
      micFocusFraction: 1,
      onTaskEvents: 50,
      locked: true,
    });
    expect(r.decision).toBe("keep_in_progress");
  });

  it("auto-dones immediately when graded submission exists", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      elapsedMinutes: 5,
      micFocusFraction: 0,
      onTaskEvents: 0,
      hasGradedSubmission: true,
    });
    expect(r.decision).toBe("auto_done");
  });

  it("distress >= 0.4 is a hard veto on academic auto-done", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      elapsedMinutes: 35,
      micFocusFraction: 0.9,
      micDistressFraction: 0.55,
      onTaskEvents: 12,
    });
    expect(r.decision).toBe("needs_human");
    expect(r.reason).toMatch(/frustrated/i);
  });

  it("movement blocks auto-complete on half-time + any signal", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      blockTitle: "Stretch break",
      subjectName: null,
      kind: "movement",
      scheduledMinutes: 10,
      elapsedMinutes: 6,
      micFocusFraction: 0,
      onTaskEvents: 0,
    });
    expect(r.decision).toBe("auto_done");
  });

  it("specials block (PE) auto-completes on half-time", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      blockTitle: "PE",
      subjectName: "Specials",
      kind: "specials",
      scheduledMinutes: 20,
      elapsedMinutes: 11,
    });
    expect(r.decision).toBe("auto_done");
  });

  it("reading_only inherits academic rules (needs duration + focus)", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      blockTitle: "Read Tuck Everlasting ch. 4",
      subjectName: "Reading",
      kind: "reading_only",
      scheduledMinutes: 25,
      elapsedMinutes: 26,
      micFocusFraction: 0.8,
      onTaskEvents: 6,
    });
    expect(r.decision).toBe("auto_done");
  });

  it("returns kid-readable reason strings (no jargon)", () => {
    const r = decideAutoListenMarkDone({
      ...base,
      elapsedMinutes: 31,
      micFocusFraction: 0.7,
      onTaskEvents: 8,
    });
    // No internal terms like "blockSortOrder", "auto_done", "decision".
    expect(r.reason).not.toMatch(/blockSortOrder|auto_done|decision|elapsedMinutes/);
  });
});
