/**
 * Wave-15 / Push 232 — kiwiVoiceAuditLogger
 *
 * Pure deterministic helper. After Reagan's "kiwi's voice is creepy"
 * feedback, we've added 4 different guards (drift, nickname,
 * length, TTS). The adults (Mom + Grandma) need a calm way to see
 * what Kiwi *almost said* and why something got swapped — not
 * because we're tattling on the AI, but because it's the only way
 * to know whether the guards are working in the wild.
 *
 * This helper takes a KiwiFullPostGenResult and produces a
 * structured audit row:
 *   - timestamp (UTC ms, caller-supplied so it's deterministic)
 *   - originalCandidate (what the LLM produced)
 *   - finalText (what Reagan actually saw)
 *   - actions: ordered list of guard actions, each with kind +
 *     summary, suitable for rendering as a bullet list in the
 *     adult review UI
 *   - severity: "info" (no change), "minor" (cleaned), "major"
 *     (fallback fired)
 *
 * Adult-facing copy rule: action summaries describe WHAT changed,
 * never blame Reagan or the LLM. No emotional language. No
 * exclamation marks. No mention of Reagan by name in the summary
 * (the candidate is shown verbatim above; we don't double-name).
 */

import type { KiwiFullPostGenResult } from "./kiwiFullPostGenPipeline";

export type KiwiAuditSeverity = "info" | "minor" | "major";

export interface KiwiAuditAction {
  kind: "drift_fallback" | "nickname_redact" | "length_cap";
  summary: string;
}

export interface KiwiVoiceAuditEntry {
  timestampUtcMs: number;
  originalCandidate: string;
  finalText: string;
  severity: KiwiAuditSeverity;
  actions: KiwiAuditAction[];
}

export interface BuildAuditInput {
  originalCandidate: string;
  result: KiwiFullPostGenResult;
  timestampUtcMs: number;
}

export function buildKiwiVoiceAuditEntry(input: BuildAuditInput): KiwiVoiceAuditEntry {
  const original = typeof input.originalCandidate === "string" ? input.originalCandidate : "";
  const ts = Number.isFinite(input.timestampUtcMs) ? Math.floor(input.timestampUtcMs) : 0;
  const r = input.result;

  const actions: KiwiAuditAction[] = [];
  let severity: KiwiAuditSeverity = "info";

  if (r.usedFallback) {
    severity = "major";
    actions.push({
      kind: "drift_fallback",
      summary:
        "Voice register check flagged the reply. Substituted the calm fallback line.",
    });
  } else {
    if (r.nicknameCleaned && r.nicknames) {
      severity = "minor";
      const terms = r.nicknames.redactedTerms;
      const list = terms.length > 0 ? terms.join(", ") : "none";
      actions.push({
        kind: "nickname_redact",
        summary: `Removed pet-name address: ${list}.`,
      });
    }
    if (r.cappedForLength && r.length) {
      if (severity === "info") severity = "minor";
      actions.push({
        kind: "length_cap",
        summary: `Trimmed to ${r.length.cappedSentenceCount} sentence(s) (was ${r.length.originalSentenceCount}).`,
      });
    }
  }

  return {
    timestampUtcMs: ts,
    originalCandidate: original,
    finalText: r.finalText,
    severity,
    actions,
  };
}
