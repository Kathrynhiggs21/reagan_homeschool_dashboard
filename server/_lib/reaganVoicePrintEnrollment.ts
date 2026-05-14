/**
 * Push 172 (2026-05-15 Wave-11) — Reagan voice-print enrollment helper.
 *
 * Pure helper. Takes 3 short audio sample fingerprints + optional metadata
 * and decides:
 *   - whether the enrollment is GOOD ENOUGH (not silent, not all-the-same,
 *     all 3 long enough, all 3 of Reagan's voice band rather than an adult)
 *   - or whether one or more samples should be RE-RECORDED (and which one)
 *
 * It also produces the canonical voice-print HASH that gets stored in the
 * `users` row + a confidence band the gate logic uses later.
 *
 * It has a SECOND mode: drift-detection. Given a previously-stored print
 * + a list of recent listening-summary fingerprints, decide whether Reagan
 * has aged out of her enrolled print and needs to re-enroll. That's the
 * only background-trigger this file is allowed to surface; the caller
 * (a cron) is what actually emails Mom.
 *
 * STRICT RULES (non-negotiable, enforced by vitest):
 *   - NEVER auto-re-enroll on Reagan's behalf.
 *   - NEVER ask Reagan for mic permission inside the suggestion text.
 *   - NEVER mention adult names in the kid-readable line ("you" only).
 *   - Drift suggestion never says "your voice changed" — kid-safe wording
 *     is "let's record a fresh sample so the dashboard knows it's you".
 *   - If sample length < MIN_SAMPLE_SECONDS, force re-record THAT slot.
 *   - If two samples have IDENTICAL fingerprint hashes, force re-record
 *     the duplicate (Reagan probably tapped record without speaking).
 *   - Adult-band detection: if a sample's medianPitchHz is below
 *     ADULT_BAND_MAX_HZ, force re-record (probably Mom or Grandma).
 *   - Confidence is bucketed: high (all 3 clean + spread), medium
 *     (2 of 3 clean), low (1 of 3 clean), unusable (0 of 3 clean).
 *   - Drift mode never fires for `unusable` enrolled prints — gate the
 *     re-enroll suggestion on the prior print being at least `medium`.
 */

const MIN_SAMPLE_SECONDS = 2.0;
const ADULT_BAND_MAX_HZ = 180; // Below this is an adult-male/-female adult band.
const KID_BAND_MIN_HZ = 200; // Reagan-aged voices typically sit above this.
const DRIFT_MIN_RECENT_SAMPLES = 5;
const DRIFT_THRESHOLD = 0.6; // ≥60% of recent listening chunks fail to match.

export interface VoiceSample {
  /** Slot number, 1-3. */
  slot: 1 | 2 | 3;
  /** Stable fingerprint hash for this audio sample (caller-computed). */
  fingerprint: string;
  /** Length in seconds (caller-measured). */
  durationSec: number;
  /** Median pitch in Hz over the sample (caller-measured). */
  medianPitchHz: number;
  /** RMS volume 0..1 (caller-measured). 0 = silent. */
  rmsVolume: number;
}

export interface EnrollmentInput {
  samples: VoiceSample[];
  /** Optional kid display name; defaults to "Reagan". */
  kidName?: string;
}

export interface SlotResult {
  slot: 1 | 2 | 3;
  status: "ok" | "redo";
  reason?:
    | "too-short"
    | "silent"
    | "duplicate"
    | "adult-voice"
    | "low-volume";
}

export type EnrollmentConfidence = "high" | "medium" | "low" | "unusable";

export interface EnrollmentResult {
  perSlot: SlotResult[];
  confidence: EnrollmentConfidence;
  /** Combined fingerprint hash for the storable voice-print. */
  voicePrintHash: string;
  /** Kid-readable next step (one short sentence, no jargon). */
  kidLine: string;
  /** Adult-readable diagnostic (one or two sentences, plain English). */
  adultLine: string;
  /** True iff the enrollment is good enough to save and use as a gate. */
  ready: boolean;
}

export function evaluateEnrollment(input: EnrollmentInput): EnrollmentResult {
  const kidName = input.kidName ?? "Reagan";
  const samples = [...input.samples].sort((a, b) => a.slot - b.slot);

  const perSlot: SlotResult[] = samples.map((s) => evaluateSlot(s, samples));
  const okCount = perSlot.filter((p) => p.status === "ok").length;

  const confidence: EnrollmentConfidence =
    okCount === 3
      ? "high"
      : okCount === 2
      ? "medium"
      : okCount === 1
      ? "low"
      : "unusable";

  const ready = confidence === "high" || confidence === "medium";

  const voicePrintHash = combineFingerprints(
    samples.filter((s, i) => perSlot[i]?.status === "ok").map((s) => s.fingerprint),
  );

  const redoSlots = perSlot.filter((p) => p.status === "redo").map((p) => p.slot);
  const kidLine = ready
    ? "Great job — the dashboard will know it's you now."
    : redoSlots.length === 1
    ? `Let's try sample ${redoSlots[0]} one more time.`
    : `Let's try a couple of those again so the dashboard hears you clearly.`;

  const adultLine = ready
    ? `Voice-print ready (${confidence}). ${kidName}'s enrollment will gate Kiwi's listening summaries.`
    : `Need a re-record. ${describeFailures(perSlot)}`;

  return {
    perSlot,
    confidence,
    voicePrintHash,
    kidLine,
    adultLine,
    ready,
  };
}

function evaluateSlot(s: VoiceSample, all: VoiceSample[]): SlotResult {
  if (s.rmsVolume === 0) {
    return { slot: s.slot, status: "redo", reason: "silent" };
  }
  if (s.rmsVolume < 0.05) {
    return { slot: s.slot, status: "redo", reason: "low-volume" };
  }
  if (s.durationSec < MIN_SAMPLE_SECONDS) {
    return { slot: s.slot, status: "redo", reason: "too-short" };
  }
  if (s.medianPitchHz <= ADULT_BAND_MAX_HZ && s.medianPitchHz < KID_BAND_MIN_HZ) {
    return { slot: s.slot, status: "redo", reason: "adult-voice" };
  }
  const dupes = all.filter(
    (other) => other.slot !== s.slot && other.fingerprint === s.fingerprint,
  );
  if (dupes.length > 0) {
    return { slot: s.slot, status: "redo", reason: "duplicate" };
  }
  return { slot: s.slot, status: "ok" };
}

function combineFingerprints(prints: string[]): string {
  if (prints.length === 0) return "";
  // Stable concat-hash. Real implementation would FNV/SHA. We keep it
  // deterministic and content-addressed but cheap for the pure helper.
  const sorted = [...prints].sort();
  const concat = sorted.join("|");
  let h = 2166136261;
  for (let i = 0; i < concat.length; i++) {
    h ^= concat.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return `vp_${prints.length}_${h.toString(16)}`;
}

function describeFailures(perSlot: SlotResult[]): string {
  const reasons = perSlot
    .filter((p) => p.status === "redo")
    .map((p) => `slot ${p.slot}: ${p.reason}`);
  return reasons.join("; ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Drift detection (mode 2)
// ─────────────────────────────────────────────────────────────────────────────

export interface DriftInput {
  /** Previously-saved enrollment confidence. */
  enrolledConfidence: EnrollmentConfidence;
  /** Hash from the saved enrollment. */
  enrolledHash: string;
  /** Recent listening-summary chunk fingerprints + match score 0..1. */
  recentChunks: { matchScore: number }[];
  /** ISO date when the enrollment was saved. */
  enrolledAtISO?: string;
  /** ISO "today" so age can be computed for the adult line only. */
  nowISO?: string;
}

export interface DriftResult {
  shouldSuggestReenroll: boolean;
  reason?: "low-match-rate" | "too-few-samples" | "stale";
  kidLine?: string;
  adultLine?: string;
}

export function detectDrift(input: DriftInput): DriftResult {
  // Never push re-enroll onto an enrollment that wasn't trusted in the
  // first place — Mom should re-enroll on her own schedule, not ours.
  if (input.enrolledConfidence === "unusable" || input.enrolledConfidence === "low") {
    return { shouldSuggestReenroll: false };
  }
  if (input.recentChunks.length < DRIFT_MIN_RECENT_SAMPLES) {
    return { shouldSuggestReenroll: false, reason: "too-few-samples" };
  }
  const failRate =
    input.recentChunks.filter((c) => c.matchScore < 0.5).length /
    input.recentChunks.length;
  if (failRate >= DRIFT_THRESHOLD) {
    return {
      shouldSuggestReenroll: true,
      reason: "low-match-rate",
      kidLine:
        "Let's record a fresh sample so the dashboard knows it's you.",
      adultLine: `Voice-print drift: ${(failRate * 100).toFixed(0)}% of recent listening chunks fall below the 0.5 match threshold across ${input.recentChunks.length} samples. Re-enroll suggested.`,
    };
  }
  return { shouldSuggestReenroll: false };
}
