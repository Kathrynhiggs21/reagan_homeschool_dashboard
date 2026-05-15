import { describe, it, expect } from "vitest";
import { summarizeKiwiVoiceAuditWindow } from "./_lib/kiwiVoiceAuditWeeklySummary";
import type { KiwiVoiceAuditEntry } from "./_lib/kiwiVoiceAuditLogger";

const TS = 1779000000000;

const makeEntry = (
  ts: number,
  severity: "info" | "minor" | "major",
  actions: KiwiVoiceAuditEntry["actions"],
  originalCandidate = "x",
): KiwiVoiceAuditEntry => ({
  timestampUtcMs: ts,
  originalCandidate,
  finalText: "y",
  severity,
  actions,
});

describe("kiwiVoiceAuditWeeklySummary — adult review rollup", () => {
  it("empty input returns zero counts + adult-tone empty headline", () => {
    const s = summarizeKiwiVoiceAuditWindow([]);
    expect(s.windowEntryCount).toBe(0);
    expect(s.totals).toEqual({ info: 0, minor: 0, major: 0 });
    expect(s.majorPercent).toBe(0);
    expect(s.headlineLine).toBe("No Kiwi replies recorded in this window.");
  });

  it("all-clean entries: 'guards did not change any of them' headline", () => {
    const s = summarizeKiwiVoiceAuditWindow([
      makeEntry(TS, "info", []),
      makeEntry(TS + 1, "info", []),
      makeEntry(TS + 2, "info", []),
    ]);
    expect(s.totals.info).toBe(3);
    expect(s.headlineLine).toBe("3 replies. Guards did not change any of them.");
  });

  it("mixed severity: counts + percent + headline correct", () => {
    const s = summarizeKiwiVoiceAuditWindow([
      makeEntry(TS, "info", []),
      makeEntry(TS + 1, "info", []),
      makeEntry(TS + 2, "minor", [
        { kind: "nickname_redact", summary: "Removed pet-name address: sweetie." },
      ]),
      makeEntry(TS + 3, "major", [
        { kind: "drift_fallback", summary: "Drift score 5; safe fallback used." },
      ]),
    ]);
    expect(s.totals).toEqual({ info: 2, minor: 1, major: 1 });
    expect(s.majorPercent).toBe(25);
    expect(s.headlineLine).toBe(
      "4 replies. Guards adjusted 2 of them (1 fallbacks, 1 minor edits).",
    );
  });

  it("topRedactedNicknames tallied across multiple entries", () => {
    const s = summarizeKiwiVoiceAuditWindow([
      makeEntry(TS, "minor", [
        { kind: "nickname_redact", summary: "Removed pet-name address: sweetie." },
      ]),
      makeEntry(TS + 1, "minor", [
        { kind: "nickname_redact", summary: "Removed pet-name address: sweetie." },
      ]),
      makeEntry(TS + 2, "minor", [
        { kind: "nickname_redact", summary: "Removed pet-name address: champ." },
      ]),
    ]);
    expect(s.topRedactedNicknames[0]).toEqual({ nickname: "sweetie", count: 2 });
    expect(s.topRedactedNicknames[1]).toEqual({ nickname: "champ", count: 1 });
  });

  it("topRedactedNicknames capped at 5", () => {
    const nicks = ["sweetie", "champ", "buddy", "pal", "honey", "dear", "kid"];
    const entries = nicks.map((n, i) =>
      makeEntry(TS + i, "minor", [
        { kind: "nickname_redact", summary: `Removed pet-name address: ${n}.` },
      ]),
    );
    const s = summarizeKiwiVoiceAuditWindow(entries);
    expect(s.topRedactedNicknames).toHaveLength(5);
  });

  it("latestMajorSamples returns last 3 (newest-first)", () => {
    const s = summarizeKiwiVoiceAuditWindow([
      makeEntry(TS + 1, "major", [{ kind: "drift_fallback", summary: "x" }], "first"),
      makeEntry(TS + 2, "major", [{ kind: "drift_fallback", summary: "x" }], "second"),
      makeEntry(TS + 3, "major", [{ kind: "drift_fallback", summary: "x" }], "third"),
      makeEntry(TS + 4, "major", [{ kind: "drift_fallback", summary: "x" }], "fourth"),
      makeEntry(TS + 5, "info", [], "ignore"),
    ]);
    expect(s.latestMajorSamples).toHaveLength(3);
    expect(s.latestMajorSamples[0].originalCandidate).toBe("fourth");
    expect(s.latestMajorSamples[1].originalCandidate).toBe("third");
    expect(s.latestMajorSamples[2].originalCandidate).toBe("second");
  });

  it("actionCounts sum across multi-action entries", () => {
    const s = summarizeKiwiVoiceAuditWindow([
      makeEntry(TS, "minor", [
        { kind: "nickname_redact", summary: "Removed pet-name address: sweetie." },
        { kind: "length_cap", summary: "Capped from 4 to 3 sentences." },
      ]),
      makeEntry(TS + 1, "major", [
        { kind: "drift_fallback", summary: "Drift score 5; safe fallback used." },
      ]),
    ]);
    expect(s.actionCounts.nickname_redact).toBe(1);
    expect(s.actionCounts.length_cap).toBe(1);
    expect(s.actionCounts.drift_fallback).toBe(1);
  });

  it("headline never contains exclamation marks (adult-tone rule)", () => {
    const s = summarizeKiwiVoiceAuditWindow([
      makeEntry(TS, "major", [{ kind: "drift_fallback", summary: "x" }]),
    ]);
    expect(s.headlineLine).not.toContain("!");
  });

  it("headline never contains emotional language", () => {
    const s = summarizeKiwiVoiceAuditWindow([
      makeEntry(TS, "major", [{ kind: "drift_fallback", summary: "x" }]),
    ]);
    expect(s.headlineLine).not.toMatch(
      /alarming|worrying|bad|terrible|great|amazing|awesome/i,
    );
  });

  it("majorPercent rounds to 1 decimal", () => {
    // 1 major out of 3 → 33.3
    const s = summarizeKiwiVoiceAuditWindow([
      makeEntry(TS, "info", []),
      makeEntry(TS + 1, "info", []),
      makeEntry(TS + 2, "major", [{ kind: "drift_fallback", summary: "x" }]),
    ]);
    expect(s.majorPercent).toBe(33.3);
  });

  it("non-array input handled gracefully", () => {
    const s = summarizeKiwiVoiceAuditWindow(
      null as unknown as KiwiVoiceAuditEntry[],
    );
    expect(s.windowEntryCount).toBe(0);
  });

  it("entries with non-finite timestamp coerce to 0 in samples", () => {
    const e: KiwiVoiceAuditEntry = {
      timestampUtcMs: NaN as unknown as number,
      originalCandidate: "x",
      finalText: "y",
      severity: "major",
      actions: [{ kind: "drift_fallback", summary: "x" }],
    };
    const s = summarizeKiwiVoiceAuditWindow([e]);
    expect(s.latestMajorSamples[0].timestampUtcMs).toBe(0);
  });

  it("unknown severity values are ignored in totals", () => {
    const e = {
      timestampUtcMs: TS,
      originalCandidate: "x",
      finalText: "y",
      severity: "weird" as unknown as "info",
      actions: [],
    } as KiwiVoiceAuditEntry;
    const s = summarizeKiwiVoiceAuditWindow([e]);
    expect(s.totals).toEqual({ info: 0, minor: 0, major: 0 });
  });

  it("is deterministic — same input → same summary", () => {
    const input = [
      makeEntry(TS, "info", []),
      makeEntry(TS + 1, "major", [{ kind: "drift_fallback", summary: "x" }]),
    ];
    const a = summarizeKiwiVoiceAuditWindow(input);
    const b = summarizeKiwiVoiceAuditWindow(input);
    expect(a).toEqual(b);
  });
});
