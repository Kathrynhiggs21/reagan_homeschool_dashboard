import { describe, it, expect } from "vitest";
import { buildKiwiVoiceAuditEntry } from "./_lib/kiwiVoiceAuditLogger";
import { runKiwiFullPostGenPipeline } from "./_lib/kiwiFullPostGenPipeline";

const TS = 1779000000000;

describe("kiwiVoiceAuditLogger — adult-readable audit entries", () => {
  it("clean reply: severity=info, no actions", () => {
    const candidate = "Got it. Open page 47.";
    const result = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result,
      timestampUtcMs: TS,
    });
    expect(entry.severity).toBe("info");
    expect(entry.actions).toEqual([]);
  });

  it("nickname-redacted reply: severity=minor, one nickname_redact action listing terms", () => {
    const candidate = "Sure, sweetie. Open page 47.";
    const result = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result,
      timestampUtcMs: TS,
    });
    expect(entry.severity).toBe("minor");
    expect(entry.actions[0].kind).toBe("nickname_redact");
    expect(entry.actions[0].summary).toContain("sweetie");
  });

  it("length-capped reply: severity=minor, length_cap action with counts", () => {
    const candidate =
      "One. Two. Three. Four. Five. Six.";
    const result = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result,
      timestampUtcMs: TS,
    });
    expect(entry.severity).toBe("minor");
    expect(entry.actions[0].kind).toBe("length_cap");
    expect(entry.actions[0].summary).toContain("3 sentence");
    expect(entry.actions[0].summary).toContain("was 6");
  });

  it("nickname + length: severity=minor, both actions in order (nickname first)", () => {
    const candidate =
      "Sure, sweetie. One. Two. Three. Four.";
    const result = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result,
      timestampUtcMs: TS,
    });
    expect(entry.severity).toBe("minor");
    expect(entry.actions.map((a) => a.kind)).toEqual([
      "nickname_redact",
      "length_cap",
    ]);
  });

  it("drift fallback: severity=major, single drift_fallback action", () => {
    const candidate = "Yay buddy! Great job, kiddo! Awesome work!";
    const result = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result,
      timestampUtcMs: TS,
    });
    expect(entry.severity).toBe("major");
    expect(entry.actions).toHaveLength(1);
    expect(entry.actions[0].kind).toBe("drift_fallback");
  });

  it("on drift fallback, nickname/length actions are NOT also added", () => {
    const candidate = "Yay buddy, great job!";
    const result = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result,
      timestampUtcMs: TS,
    });
    expect(entry.actions).toHaveLength(1);
    expect(entry.actions[0].kind).toBe("drift_fallback");
  });

  it("originalCandidate and finalText surfaced verbatim", () => {
    const candidate = "Got it.";
    const result = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result,
      timestampUtcMs: TS,
    });
    expect(entry.originalCandidate).toBe(candidate);
    expect(entry.finalText).toBe(result.finalText);
  });

  it("timestamp stored as integer UTC ms", () => {
    const result = runKiwiFullPostGenPipeline({
      candidate: "Got it.",
      maxSentences: 3,
    });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: "Got it.",
      result,
      timestampUtcMs: TS + 0.7,
    });
    expect(entry.timestampUtcMs).toBe(TS);
  });

  it("non-finite timestamp coerces to 0 (no NaN leakage)", () => {
    const result = runKiwiFullPostGenPipeline({
      candidate: "Got it.",
      maxSentences: 3,
    });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: "Got it.",
      result,
      timestampUtcMs: NaN,
    });
    expect(entry.timestampUtcMs).toBe(0);
  });

  it("non-string originalCandidate coerces to empty string", () => {
    const result = runKiwiFullPostGenPipeline({
      candidate: "Got it.",
      maxSentences: 3,
    });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: undefined as unknown as string,
      result,
      timestampUtcMs: TS,
    });
    expect(entry.originalCandidate).toBe("");
  });

  it("action summaries contain no exclamation marks (adult-tone rule)", () => {
    const candidate = "Sure, sweetie. One. Two. Three. Four.";
    const result = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result,
      timestampUtcMs: TS,
    });
    for (const action of entry.actions) {
      expect(action.summary).not.toContain("!");
    }
  });

  it("action summaries contain no Reagan's name (we don't double-name)", () => {
    const candidate = "Sure, sweetie.";
    const result = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const entry = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result,
      timestampUtcMs: TS,
    });
    for (const action of entry.actions) {
      expect(action.summary).not.toMatch(/\bReagan\b/);
    }
  });

  it("is deterministic — same inputs → same audit entry", () => {
    const candidate = "Sure, sweetie. Open page 47.";
    const r1 = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const r2 = runKiwiFullPostGenPipeline({ candidate, maxSentences: 3 });
    const a = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result: r1,
      timestampUtcMs: TS,
    });
    const b = buildKiwiVoiceAuditEntry({
      originalCandidate: candidate,
      result: r2,
      timestampUtcMs: TS,
    });
    expect(a).toEqual(b);
  });
});
