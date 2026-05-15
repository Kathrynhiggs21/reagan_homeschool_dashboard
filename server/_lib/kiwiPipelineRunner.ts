/**
 * Wave-15 / Push 222 — kiwiPipelineRunner
 *
 * Pure deterministic orchestrator. The Kiwi voice pipeline now has
 * three pieces:
 *   1. Pre-gen voice steering        (Push 218/219, kiwiVoiceSettings)
 *   2. Post-gen tone drift detector  (Push 216/217, kiwiToneDriftDetector)
 *   3. Post-gen sentence cap         (Push 220/221, kiwiResponseLengthCapper)
 *
 * Calling three procedures in a row from the UI is fragile. This
 * helper bundles steps 2 and 3 (post-gen) so the UI does exactly one
 * call after the LLM returns. Step 1 still runs once at the start
 * of the LLM call (system prompt prep) and is not bundled here.
 *
 * Decision rule:
 *   - Run drift detector. If flagged → output is the safeFallback;
 *     length cap NOT applied (fallback is already short).
 *   - Otherwise → run sentence cap on the cleanedPreview (which is
 *     already light-stripped) so the final reply is both on-tone
 *     AND short.
 *
 * Output preserves the upstream diagnostics so the UI / audit log
 * can see why a fallback fired.
 */

import { detectKiwiToneDrift, type ToneDriftResult } from "./kiwiToneDriftDetector";
import {
  capKiwiResponseLength,
  type KiwiCappedResult,
} from "./kiwiResponseLengthCapper";

export interface KiwiPipelineInput {
  /** Raw LLM output that we're about to show Reagan. */
  candidate: string;
  /** Sentence cap from the active voice profile (e.g. 3 for older_cousin). */
  maxSentences: number;
}

export interface KiwiPipelineResult {
  /** What the UI should actually render to Reagan. */
  finalText: string;
  /** True if the drift detector kicked in and we substituted safeFallback. */
  usedFallback: boolean;
  /** True if length cap trimmed the reply (will be false when usedFallback=true). */
  cappedForLength: boolean;
  /** Full drift diagnostics for audit / UI reasons-card. */
  drift: ToneDriftResult;
  /** Full length diagnostics for audit. Null when fallback fired. */
  length: KiwiCappedResult | null;
}

export function runKiwiPostGenPipeline(input: KiwiPipelineInput): KiwiPipelineResult {
  const candidate = typeof input.candidate === "string" ? input.candidate : "";
  const cap = Math.max(1, Math.floor(input.maxSentences || 3));

  const drift = detectKiwiToneDrift(candidate);

  if (drift.flagged) {
    return {
      finalText: drift.safeFallback,
      usedFallback: true,
      cappedForLength: false,
      drift,
      length: null,
    };
  }

  // Use the cleanedPreview (light-stripped of !!!/~~~/...) as input
  // to the length cap so the final output never carries the obvious
  // pre-clean artifacts.
  const length = capKiwiResponseLength(drift.cleanedPreview, cap);

  return {
    finalText: length.text,
    usedFallback: false,
    cappedForLength: length.capped,
    drift,
    length,
  };
}
