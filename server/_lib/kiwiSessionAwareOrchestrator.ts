/**
 * Wave-15 / Push 257 — kiwiSessionAwareOrchestrator
 *
 * Highest-level pure composition that takes a single unified
 * KiwiChatSessionState as input and returns a new unified state
 * as output, alongside the orchestrator result. This is the
 * variant the chat UI will use in production: ONE localStorage
 * key in, ONE localStorage key out, no separate streak/rotation
 * bookkeeping at the call site.
 *
 * Internally it:
 *   1. Resolves the voice profile from the panel
 *   2. Runs the full post-gen pipeline at the profile's cap
 *   3. Derives a drift severity from the pipeline result
 *   4. Applies the unified session event (streak + rotation)
 *      to compute (a) whether blessed fallback fires, (b) the
 *      rotation seed to use if it does, (c) the new session state
 *   5. If blessed fired, substitutes pickKiwiBlessedLine using
 *      the new rotation seed
 *   6. Builds the audit entry from the final substituted text
 *
 * Pure: no DB, no LLM, no network.
 */

import { resolveKiwiVoiceProfile } from "./kiwiVoiceProfileResolver";
import { resolveKiwiVoiceSettings } from "./kiwiVoiceSettings";
import { runKiwiFullPostGenPipeline } from "./kiwiFullPostGenPipeline";
import {
  applyKiwiChatSessionEvent,
  type KiwiChatSessionState,
} from "./kiwiChatSessionState";
import { pickKiwiBlessedLine } from "./kiwiVoiceSampleBlessings";
import {
  buildKiwiVoiceAuditEntry,
  type KiwiVoiceAuditEntry,
} from "./kiwiVoiceAuditLogger";

export interface KiwiSessionAwareInput {
  panel: string | null | undefined;
  candidate: string;
  priorSessionState: KiwiChatSessionState | null | undefined;
  timestampUtcMs: number;
}

export interface KiwiSessionAwareResult {
  finalText: string;
  blessedFallbackFired: boolean;
  newSessionState: KiwiChatSessionState;
  auditEntry: KiwiVoiceAuditEntry;
  profile: ReturnType<typeof resolveKiwiVoiceProfile>;
  appliedSentenceCap: number;
  /** Adult-tone reason string when blessedFallbackFired is true. */
  fallbackReason: string;
}

export function runKiwiSessionAwareOrchestrator(
  input: KiwiSessionAwareInput,
): KiwiSessionAwareResult {
  const panel = typeof input.panel === "string" ? input.panel : null;
  const candidate = typeof input.candidate === "string" ? input.candidate : "";

  const profile = resolveKiwiVoiceProfile(panel);
  const settings = resolveKiwiVoiceSettings({ profile: profile.profile });

  const pipeline = runKiwiFullPostGenPipeline({
    candidate,
    maxSentences: settings.sentenceCap,
  });

  let severity: "info" | "minor" | "major" = "info";
  if (pipeline.usedFallback) severity = "major";
  else if (pipeline.nicknameCleaned || pipeline.cappedForLength) severity = "minor";

  const sessionUpdate = applyKiwiChatSessionEvent(
    input.priorSessionState ?? null,
    {
      panel: panel ?? "today",
      severity,
      timestampUtcMs: input.timestampUtcMs,
    },
  );

  let finalText = pipeline.finalText;
  let blessedFallbackFired = false;
  let fallbackReason = "";

  if (sessionUpdate.shouldUseBlessedFallback) {
    finalText = pickKiwiBlessedLine({
      panel: panel ?? "today",
      rotationSeed: sessionUpdate.rotationSeedForBlessedPick,
    });
    blessedFallbackFired = true;
    fallbackReason = `Two drift fallbacks in a row on the ${
      panel ?? "today"
    } panel. Showing a blessed line instead.`;
  }

  const auditResult = blessedFallbackFired
    ? { ...pipeline, finalText, usedFallback: true }
    : pipeline;
  const auditEntry = buildKiwiVoiceAuditEntry({
    originalCandidate: candidate,
    result: auditResult,
    timestampUtcMs: input.timestampUtcMs,
  });

  return {
    finalText,
    blessedFallbackFired,
    newSessionState: sessionUpdate.state,
    auditEntry,
    profile,
    appliedSentenceCap: settings.sentenceCap,
    fallbackReason,
  };
}
