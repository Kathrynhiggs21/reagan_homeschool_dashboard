/**
 * Push 104 (2026-05-13) — Listening-summary mood + behavior normalizer.
 *
 * When Kiwi posts a listening chunk, it sends a free-form summary +
 * Reagan-voice flag + a content classifier. The dashboard needs a
 * deterministic normalizer that:
 *   - clamps moodEstimate to the canonical enum
 *   - clamps behaviorTags[] to the canonical set + dedupes + caps length
 *   - returns the gate decision (counts toward coverage or mood-only)
 *
 * Pure module — deterministic, no DB. Mirrors the slice 4.5 contract
 * documented in todo.md.
 */
import {
  SCHOOL_CONTENT_CLASSIFIERS,
  type ContentClassifier,
} from "./reaganVoiceProvenanceBadge";

export type MoodEstimate =
  | "calm"
  | "engaged"
  | "frustrated"
  | "tired"
  | "silly"
  | "upset"
  | "excited";

export type BehaviorTag =
  | "focused"
  | "distracted"
  | "talking-back"
  | "asking-questions"
  | "off-topic"
  | "helping-out"
  | "refusing";

export const MOOD_VALUES: readonly MoodEstimate[] = [
  "calm",
  "engaged",
  "frustrated",
  "tired",
  "silly",
  "upset",
  "excited",
] as const;

export const BEHAVIOR_VALUES: readonly BehaviorTag[] = [
  "focused",
  "distracted",
  "talking-back",
  "asking-questions",
  "off-topic",
  "helping-out",
  "refusing",
] as const;

const MOOD_SET = new Set<MoodEstimate>(MOOD_VALUES);
const BEHAVIOR_SET = new Set<BehaviorTag>(BEHAVIOR_VALUES);
const SCHOOL_CLASSIFIER_SET = new Set<ContentClassifier>(
  SCHOOL_CONTENT_CLASSIFIERS,
);

const MAX_BEHAVIOR_TAGS = 4;

export interface RawListeningSummary {
  reaganVoicePresent?: boolean;
  moodEstimate?: string | null;
  behaviorTags?: string[] | null;
  contentClassifier?: string | null;
}

export interface NormalizedListeningSummary {
  reaganVoicePresent: boolean;
  moodEstimate: MoodEstimate | null;
  behaviorTags: BehaviorTag[];
  contentClassifier: ContentClassifier | null;
  /**
   * True iff the chunk should be eligible for actual-coverage credit —
   * i.e., Reagan voice present AND classifier is in the school set.
   * Mood + behavior are recorded regardless.
   */
  countsTowardCoverage: boolean;
}

function clampMood(v: unknown): MoodEstimate | null {
  if (typeof v !== "string") return null;
  return MOOD_SET.has(v as MoodEstimate) ? (v as MoodEstimate) : null;
}

function clampBehaviorTags(arr: unknown): BehaviorTag[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<BehaviorTag>();
  const out: BehaviorTag[] = [];
  for (const x of arr) {
    if (typeof x !== "string") continue;
    if (!BEHAVIOR_SET.has(x as BehaviorTag)) continue;
    const tag = x as BehaviorTag;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_BEHAVIOR_TAGS) break;
  }
  return out;
}

function clampClassifier(v: unknown): ContentClassifier | null {
  if (typeof v !== "string") return null;
  const all: ContentClassifier[] = [
    "lesson",
    "reading-aloud",
    "problem-solving",
    "discussion-on-topic",
    "adult-led-school-activity",
    "off-topic",
    "tv",
    "silence",
  ];
  return (all as string[]).includes(v) ? (v as ContentClassifier) : null;
}

export function normalizeListeningSummary(
  raw: RawListeningSummary,
): NormalizedListeningSummary {
  const reaganVoicePresent = raw.reaganVoicePresent === true;
  const moodEstimate = clampMood(raw.moodEstimate);
  const behaviorTags = clampBehaviorTags(raw.behaviorTags);
  const contentClassifier = clampClassifier(raw.contentClassifier);

  const countsTowardCoverage =
    reaganVoicePresent &&
    contentClassifier !== null &&
    SCHOOL_CLASSIFIER_SET.has(contentClassifier);

  return {
    reaganVoicePresent,
    moodEstimate,
    behaviorTags,
    contentClassifier,
    countsTowardCoverage,
  };
}
