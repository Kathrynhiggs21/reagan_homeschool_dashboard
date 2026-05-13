/**
 * Push 100 (2026-05-13) — Reagan-voice provenance badge pure helper.
 *
 * The Actual-vs-Planned strip surfaces a tiny mic+Reagan icon on any
 * actualAgendaEntries row whose evidence was Reagan's confirmed voice
 * via Kiwi listening. Mom + Grandma + tutors need to be able to verify
 * provenance at a glance — "this came from Reagan's voice, not a guess".
 *
 * Rules (mirrors slice 4.5 contract):
 *   - source='kiwi-listened' AND reaganVoicePresent=true AND
 *     contentClassifier ∈ {lesson, reading-aloud, problem-solving,
 *     discussion-on-topic, adult-led-school-activity}  → badge "verified"
 *   - source='kiwi-listened' AND reaganVoicePresent=true but classifier
 *     NOT in the allow-list (e.g., off-topic chitchat) → "voice-only"
 *     (mood/behavior still recorded, but it does NOT count toward
 *     coverage — the badge is dimmed)
 *   - any non-kiwi-listened source → null (no badge needed)
 *
 * Pure module — deterministic, no DB.
 */

export type ActualSource =
  | "kiwi-listened"
  | "mom"
  | "grandma"
  | "tutor"
  | "reagan-checkin"
  | "auto-derived";

export type ContentClassifier =
  | "lesson"
  | "reading-aloud"
  | "problem-solving"
  | "discussion-on-topic"
  | "adult-led-school-activity"
  | "off-topic"
  | "tv"
  | "silence";

export interface ReaganVoiceProvenanceInput {
  source: ActualSource;
  reaganVoicePresent?: boolean;
  contentClassifier?: ContentClassifier | null;
}

export type ReaganVoiceProvenanceBadge =
  | { kind: "verified"; tooltip: string }
  | { kind: "voice-only"; tooltip: string }
  | null;

/** Single source of truth: which classifier values count toward coverage. */
export const SCHOOL_CONTENT_CLASSIFIERS: readonly ContentClassifier[] = [
  "lesson",
  "reading-aloud",
  "problem-solving",
  "discussion-on-topic",
  "adult-led-school-activity",
] as const;

const SCHOOL_SET = new Set<ContentClassifier>(SCHOOL_CONTENT_CLASSIFIERS);

export function reaganVoiceProvenanceBadge(
  input: ReaganVoiceProvenanceInput,
): ReaganVoiceProvenanceBadge {
  if (input.source !== "kiwi-listened") return null;
  if (input.reaganVoicePresent !== true) return null;

  const cls = input.contentClassifier ?? null;
  if (cls && SCHOOL_SET.has(cls)) {
    return {
      kind: "verified",
      tooltip:
        "Reagan's voice was heard on this activity and Kiwi classified it as school content. This entry counts toward coverage.",
    };
  }
  return {
    kind: "voice-only",
    tooltip:
      "Reagan's voice was heard but Kiwi did not classify this as school content. Mood and behavior were recorded; this does NOT count toward coverage.",
  };
}
