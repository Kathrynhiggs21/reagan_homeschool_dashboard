/**
 * Wave-15 / Push 230 — kiwiFullPostGenPipeline
 *
 * Pure deterministic orchestrator. Push 222 bundled drift + length;
 * Push 228 added the nickname guard. The UI should still make ONE
 * call after the LLM returns, so this re-orchestrates the full
 * three-step post-gen pipeline:
 *
 *   1. drift detector (Push 216) — register-level guard
 *      - flagged → return safeFallback, skip downstream steps
 *   2. nickname guard (Push 228) — surgical pet-name redact
 *      - runs on the drift detector's cleanedPreview
 *   3. length cap (Push 220) — sentence cap from active voice profile
 *      - runs on the nickname-cleaned text
 *
 * This replaces the older two-step bundle for new callers. The
 * older today.kiwiPostGenPipeline procedure remains wired (Push 223)
 * so existing UI code keeps working without breakage; the new
 * today.kiwiFullPostGenPipeline (Push 231) is the recommended call
 * going forward.
 *
 * Output preserves diagnostics from every step so the audit log
 * can reconstruct exactly what was changed and why.
 */

import { detectKiwiToneDrift, type ToneDriftResult } from "./kiwiToneDriftDetector";
import {
  capKiwiResponseLength,
  type KiwiCappedResult,
} from "./kiwiResponseLengthCapper";
import {
  guardKiwiNicknames,
  type NicknameGuardResult,
} from "./kiwiNicknameGuard";

export interface KiwiFullPostGenInput {
  candidate: string;
  maxSentences: number;
}

export interface KiwiFullPostGenResult {
  finalText: string;
  usedFallback: boolean;
  nicknameCleaned: boolean;
  cappedForLength: boolean;
  drift: ToneDriftResult;
  nicknames: NicknameGuardResult | null;
  length: KiwiCappedResult | null;
}

export function runKiwiFullPostGenPipeline(
  input: KiwiFullPostGenInput,
): KiwiFullPostGenResult {
  const candidate = typeof input.candidate === "string" ? input.candidate : "";
  const requested = Math.floor(Number(input.maxSentences));
  const cap = !Number.isFinite(requested) || requested <= 0 ? 3 : requested;

  const drift = detectKiwiToneDrift(candidate);

  if (drift.flagged) {
    return {
      finalText: drift.safeFallback,
      usedFallback: true,
      nicknameCleaned: false,
      cappedForLength: false,
      drift,
      nicknames: null,
      length: null,
    };
  }

  const nicknames = guardKiwiNicknames(drift.cleanedPreview);
  const length = capKiwiResponseLength(nicknames.cleanedText, cap);

  return {
    finalText: length.text,
    usedFallback: false,
    nicknameCleaned: nicknames.changed,
    cappedForLength: length.capped,
    drift,
    nicknames,
    length,
  };
}
