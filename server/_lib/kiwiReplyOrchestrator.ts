/**
 * Wave-15 / Push 251 — kiwiReplyOrchestrator
 *
 * Highest-level pure composition. The chat UI calls this exactly
 * once per LLM completion. The orchestrator chains:
 *
 *   1. resolveKiwiVoiceProfile(panel)           → which voice
 *   2. resolveKiwiVoiceSettings({profile})          → sentence cap
 *   3. runKiwiFullPostGenPipeline(candidate)    → drift / nick / len
 *   4. applyKiwiDriftEvent(priorStreak, severity)
 *      a. If shouldUseBlessedFallback → pickKiwiBlessedLine
 *         and override finalText
 *      b. Else → keep the pipeline finalText
 *   5. buildKiwiVoiceAuditEntry(originalCandidate, pipelineResult)
 *
 * Returns everything the UI needs in one shot: the text to display,
 * the new streak state to persist back to the browser, the audit
 * entry to record, and a flag telling the UI whether a blessed
 * fallback was substituted.
 *
 * Pure: no DB, no LLM, no network. The DB persistence step still
 * lives in today.kiwiVoiceAuditPersist on the router side.
 *
 * Adult-tone copy rules enforced in vitests across all paths.
 */

import { resolveKiwiVoiceProfile } from "./kiwiVoiceProfileResolver";
import { resolveKiwiVoiceSettings } from "./kiwiVoiceSettings";
import { runKiwiFullPostGenPipeline } from "./kiwiFullPostGenPipeline";
import {
  applyKiwiDriftEvent,
  type KiwiDriftStreakState,
} from "./kiwiDriftStreakTracker";
import { pickKiwiBlessedLine } from "./kiwiVoiceSampleBlessings";
import { buildKiwiVoiceAuditEntry } from "./kiwiVoiceAuditLogger";
import type { KiwiVoiceAuditEntry } from "./kiwiVoiceAuditLogger";

export interface KiwiReplyOrchestratorInput {
  panel: string | null | undefined;
  candidate: string;
  priorStreakState: KiwiDriftStreakState | null | undefined;
  timestampUtcMs: number;
  rotationSeed: number;
}

export interface KiwiReplyOrchestratorResult {
  /** Text the UI should render to Reagan. */
  finalText: string;
  /** True iff the streak crossed threshold and a blessed line was substituted. */
  blessedFallbackFired: boolean;
  /** New streak state — UI must persist this back into local storage. */
  newStreakState: KiwiDriftStreakState;
  /** Audit row to send to today.kiwiVoiceAuditPersist. */
  auditEntry: KiwiVoiceAuditEntry;
  /** Resolved profile (for diagnostics + the audit page). */
  profile: ReturnType<typeof resolveKiwiVoiceProfile>;
  /** Sentence cap that was actually used. */
  appliedSentenceCap: number;
  /** Adult-tone reason string when blessedFallbackFired is true. */
  fallbackReason: string;
}

export function runKiwiReplyOrchestrator(
  input: KiwiReplyOrchestratorInput,
): KiwiReplyOrchestratorResult {
  const panel = typeof input.panel === "string" ? input.panel : null;
  const candidate = typeof input.candidate === "string" ? input.candidate : "";

  // 1. Resolve voice profile from panel
  const profile = resolveKiwiVoiceProfile(panel);
  // 2. Get voice settings (sentence cap)
  const settings = resolveKiwiVoiceSettings({ profile: profile.profile });

  // 3. Run the post-gen pipeline
  const pipeline = runKiwiFullPostGenPipeline({
    candidate,
    maxSentences: settings.sentenceCap,
  });

  // 4. Apply drift event to streak state. Severity is derived from
  //    the pipeline result, using the same convention the audit
  //    builder uses: usedFallback → major; any other change → minor;
  //    no change → info.
  let severity: "info" | "minor" | "major" = "info";
  if (pipeline.usedFallback) severity = "major";
  else if (pipeline.nicknameCleaned || pipeline.cappedForLength) severity = "minor";

  const streakUpdate = applyKiwiDriftEvent(input.priorStreakState ?? null, {
    panel: panel ?? "today",
    severity,
    timestampUtcMs: input.timestampUtcMs,
  });

  // 5. If streak crossed threshold, substitute a blessed line.
  let finalText = pipeline.finalText;
  let blessedFallbackFired = false;
  let fallbackReason = "";
  if (streakUpdate.shouldUseBlessedFallback) {
    finalText = pickKiwiBlessedLine({
      panel: panel ?? "today",
      rotationSeed: input.rotationSeed,
    });
    blessedFallbackFired = true;
    fallbackReason = streakUpdate.fallbackReason;
  }

  // 6. Build audit entry from the (possibly substituted) finalText.
  //    The audit builder takes the pipeline result, so we synthesize
  //    a result with the substituted text when blessed fired.
  const auditPipelineResult = blessedFallbackFired
    ? { ...pipeline, finalText, usedFallback: true }
    : pipeline;
  const auditEntry = buildKiwiVoiceAuditEntry({
    originalCandidate: candidate,
    result: auditPipelineResult,
    timestampUtcMs: input.timestampUtcMs,
  });

  return {
    finalText,
    blessedFallbackFired,
    newStreakState: streakUpdate.state,
    auditEntry,
    profile,
    appliedSentenceCap: settings.sentenceCap,
    fallbackReason,
  };
}
