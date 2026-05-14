/**
 * Push 158 (2026-05-14) — vitest contract for adult quick-entry payload builder.
 */
import { describe, it, expect } from "vitest";
import { buildAdultQuickEntryPayload } from "./_lib/adultQuickEntryPayload";

const DAY = "2026-05-14";

describe("Push 158 — buildAdultQuickEntryPayload", () => {
  it("turns a Mom one-liner into a typed actual-agenda entry", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "Math: workbook page 42, 25 min, did great" },
    ]);
    expect(p.actualEntries).toHaveLength(1);
    const e = p.actualEntries[0];
    expect(e.subject).toBe("math");
    expect(e.minutesSpent).toBe(25);
    expect(e.outcome).toBe("great");
    expect(e.displayLabel).toBe("Math · 25 min · did great");
  });

  it("preserves rawLine and trims whatTheyDid", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "  Reading: Tuck Everlasting chapter 4, 20 min, did fine  " },
    ]);
    const e = p.actualEntries[0];
    expect(e.subject).toBe("reading");
    expect(e.outcome).toBe("okay");
    expect(e.whatTheyDid).toContain("Tuck Everlasting chapter 4");
    expect(e.rawLine.startsWith("Reading")).toBe(true);
  });

  it("handles 'skipped' outcome cleanly", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "Science: skipped today" },
    ]);
    expect(p.actualEntries[0].outcome).toBe("skipped");
    expect(p.actualEntries[0].displayLabel).toContain("skipped");
  });

  it("builds Drive day-log markdown with the correct file name", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "Math: page 42, 25 min, did great" },
      { rawLine: "Reading: chapter 4, 20 min, did fine" },
    ]);
    expect(p.driveEnqueue.targetFolder).toBe("day_logs");
    expect(p.driveEnqueue.fileBaseName).toBe(`Reagan-day-log-${DAY}`);
    expect(p.driveEnqueue.markdownBody).toContain(`# Reagan's day — ${DAY}`);
    expect(p.driveEnqueue.markdownBody).toContain("Math · 25 min · did great");
    expect(p.driveEnqueue.markdownBody).toContain("Reading · 20 min · did fine");
  });

  it("notification body summarizes total minutes + subjects", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "Math: page 42, 25 min, did great" },
      { rawLine: "Reading: chapter 4, 20 min, did fine" },
    ]);
    expect(p.notificationBody).toContain("2 blocks");
    expect(p.notificationBody).toContain("45 min");
    expect(p.notificationBody.toLowerCase()).toContain("math");
    expect(p.notificationBody.toLowerCase()).toContain("reading");
  });

  it("hour expressions count as 60 min each", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "Reading: 1 hour, did great" },
    ]);
    expect(p.actualEntries[0].minutesSpent).toBe(60);
  });

  it("clamps minutes to 240 max", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "Math: 9999 min, did fine" },
    ]);
    expect(p.actualEntries[0].minutesSpent).toBe(240);
  });

  it("empty/whitespace lines are ignored", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "   " },
      { rawLine: "" },
    ]);
    expect(p.actualEntries).toHaveLength(0);
    expect(p.driveEnqueue.markdownBody).toContain("(No blocks logged.)");
  });

  it("plannedBlockId flows through when provided", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "Math: page 42, 25 min, did great", plannedBlockId: "blk_123" },
    ]);
    expect(p.actualEntries[0].plannedBlockId).toBe("blk_123");
  });

  it("rejects bad ISO date", () => {
    expect(() => buildAdultQuickEntryPayload("2026-5-14", [])).toThrow(/YYYY-MM-DD/);
  });

  it("subject defaults to unspecified when no hint", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "we did stuff for 10 min" },
    ]);
    expect(p.actualEntries[0].subject).toBe("unspecified");
    expect(p.actualEntries[0].displayLabel).toBe("Activity · 10 min");
  });

  it("displayLabel never includes raw outcome enum value", () => {
    const p = buildAdultQuickEntryPayload(DAY, [
      { rawLine: "Math: 25 min, did great" },
    ]);
    expect(p.actualEntries[0].displayLabel.toLowerCase()).not.toContain("outcome");
  });
});
