/**
 * Push 107 (2026-05-13) — Off-plan topic auto-add to curriculum gating.
 *
 * When Reagan does something off-plan that Kiwi (or Mom/Grandma) logs
 * with a topic label that isn't in the 5th-grade Ohio curriculum, the
 * dashboard should propose adding it as a "discovered topic" so future
 * coverage analytics know about it. We do NOT auto-promote everything
 * — that would clutter the curriculum table — so this helper holds the
 * gating logic in one deterministic place.
 *
 * Promotion rules:
 *   - candidate must have a non-empty trimmed topic label
 *   - label must NOT already exist in the curriculum (case-insensitive)
 *   - subjectSlug must be one of the canonical 5 subjects
 *   - confidence (Kiwi's labelling confidence 0..1) must be ≥ 0.6
 *   - if duplicateLabel from a prior off-plan capture exists, accumulate
 *     hits before promoting (≥ 2 captures within the window) — single
 *     accidental utterances should not bloat the curriculum
 *   - manualOverride=true (Mom/Grandma "yes, add this") always promotes
 *
 * Pure module — deterministic, no DB, no I/O.
 */

export type CanonicalSubject =
  | "math"
  | "ela"
  | "science"
  | "social-studies"
  | "specials";

export const CANONICAL_SUBJECTS: readonly CanonicalSubject[] = [
  "math",
  "ela",
  "science",
  "social-studies",
  "specials",
] as const;

const SUBJECT_SET = new Set<CanonicalSubject>(CANONICAL_SUBJECTS);

export interface OffPlanTopicCandidate {
  topicLabel: string;
  subjectSlug: string;
  /** Kiwi's labelling confidence, 0..1. Defaults to 0. */
  confidence?: number;
  /** Whether Mom/Grandma manually said "yes, add this". */
  manualOverride?: boolean;
  /** Repeat count of this label across recent off-plan captures. */
  recentHitCount?: number;
}

export interface CurriculumIndex {
  /** Lower-cased existing topic labels in the curriculum table. */
  existingLabels: ReadonlyArray<string>;
}

export type AutoAddDecision =
  | { promote: true; reason: "manual-override" }
  | { promote: true; reason: "kiwi-confident" }
  | { promote: true; reason: "repeated-capture" }
  | { promote: false; reason: "empty-label" }
  | { promote: false; reason: "already-in-curriculum" }
  | { promote: false; reason: "non-canonical-subject" }
  | { promote: false; reason: "low-confidence-single-hit" };

const MIN_CONFIDENCE = 0.6;
const MIN_REPEAT_HITS = 2;

export function decideOffPlanTopicAutoAdd(
  candidate: OffPlanTopicCandidate,
  index: CurriculumIndex,
): AutoAddDecision {
  const label = (candidate.topicLabel ?? "").trim();
  if (label.length === 0) {
    return { promote: false, reason: "empty-label" };
  }
  const labelLower = label.toLowerCase();

  // Validate subject FIRST so wrong-subject candidates never enter
  // the curriculum, regardless of overrides.
  if (!SUBJECT_SET.has(candidate.subjectSlug as CanonicalSubject)) {
    return { promote: false, reason: "non-canonical-subject" };
  }

  // Already-known topics are a no-op.
  const existing = new Set(
    (index.existingLabels ?? []).map((s) => s.trim().toLowerCase()),
  );
  if (existing.has(labelLower)) {
    return { promote: false, reason: "already-in-curriculum" };
  }

  // Manual override wins (Mom/Grandma deliberately added it).
  if (candidate.manualOverride === true) {
    return { promote: true, reason: "manual-override" };
  }

  const confidence =
    typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
      ? Math.max(0, Math.min(1, candidate.confidence))
      : 0;
  const hits = Math.max(1, Math.floor(candidate.recentHitCount ?? 1));

  if (confidence >= MIN_CONFIDENCE) {
    return { promote: true, reason: "kiwi-confident" };
  }

  if (hits >= MIN_REPEAT_HITS) {
    return { promote: true, reason: "repeated-capture" };
  }

  return { promote: false, reason: "low-confidence-single-hit" };
}
