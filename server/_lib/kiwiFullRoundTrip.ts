/**
 * Wave-15 / Push 241 — kiwiFullRoundTrip
 *
 * Pure deterministic dry-run of the full Kiwi exchange WITHOUT
 * actually calling the LLM. Useful for two scenarios:
 *
 *   1. Integration tests that need to verify the whole pipeline
 *      (pre-gen + post-gen + audit) end-to-end without mocking
 *      the LLM endpoint.
 *   2. An adult dev tool: paste a candidate reply, see exactly
 *      what would happen — which profile would be picked for
 *      the panel, whether the post-gen guards would flag it,
 *      and what the audit row would look like.
 *
 * The caller supplies the LLM candidate text directly. Composition:
 *   panel → buildKiwiPreGenBundle (panel → profile + voice + pacing)
 *   candidate + sentenceCap → runKiwiFullPostGenPipeline
 *   original + result + timestamp → buildKiwiVoiceAuditEntry
 *
 * Returns the bundle, the pipeline result, AND the audit entry.
 */

import { buildKiwiPreGenBundle, type KiwiPreGenBundle } from "./kiwiPreGenBundle";
import {
  runKiwiFullPostGenPipeline,
  type KiwiFullPostGenResult,
} from "./kiwiFullPostGenPipeline";
import {
  buildKiwiVoiceAuditEntry,
  type KiwiVoiceAuditEntry,
} from "./kiwiVoiceAuditLogger";

export interface KiwiFullRoundTripInput {
  panel: string | null | undefined;
  candidate: string;
  timestampUtcMs: number;
}

export interface KiwiFullRoundTripResult {
  preGen: KiwiPreGenBundle;
  postGen: KiwiFullPostGenResult;
  audit: KiwiVoiceAuditEntry;
}

export function runKiwiFullRoundTrip(
  input: KiwiFullRoundTripInput,
): KiwiFullRoundTripResult {
  const candidate = typeof input.candidate === "string" ? input.candidate : "";
  const preGen = buildKiwiPreGenBundle({ panel: input.panel ?? null });
  const postGen = runKiwiFullPostGenPipeline({
    candidate,
    maxSentences: preGen.voice.sentenceCap,
  });
  const audit = buildKiwiVoiceAuditEntry({
    originalCandidate: candidate,
    result: postGen,
    timestampUtcMs: input.timestampUtcMs,
  });
  return { preGen, postGen, audit };
}
