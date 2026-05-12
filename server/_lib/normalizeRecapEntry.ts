/**
 * Pure helpers for normalizing LLM-extracted recap entries.
 * Kept separate from `scheduledSync.ts` so they can be unit-tested without DB.
 */

export const VALID_SUBJECT_SLUGS = [
  "math",
  "ela",
  "science",
  "social-studies",
  "life-skills",
  "art",
  "music",
  "pe",
  "social-emotional",
  "other",
] as const;

export type ValidSubjectSlug = typeof VALID_SUBJECT_SLUGS[number];

const SLUG_ALIASES: Record<string, ValidSubjectSlug> = {
  // common LLM variants
  "Math": "math",
  "MATH": "math",
  "mathematics": "math",
  "arithmetic": "math",
  "ELA": "ela",
  "english": "ela",
  "english-language-arts": "ela",
  "language-arts": "ela",
  "reading": "ela",
  "writing": "ela",
  "Science": "science",
  "Social Studies": "social-studies",
  "social_studies": "social-studies",
  "history": "social-studies",
  "geography": "social-studies",
  "civics": "social-studies",
  "Life Skills": "life-skills",
  "life_skills": "life-skills",
  "Art": "art",
  "Music": "music",
  "PE": "pe",
  "physical-education": "pe",
  "gym": "pe",
  "Social Emotional": "social-emotional",
  "social_emotional": "social-emotional",
  "SEL": "social-emotional",
  "social emotional": "social-emotional",
  "Other": "other",
};

export const MAX_REPLY_TEXT_LENGTH = 50_000; // hard cap to prevent DoS
export const MAX_MINUTES_PER_ENTRY = 720; // 12 hours
export const MIN_TOPIC_LENGTH = 1;
export const MAX_TOPIC_LENGTH = 500;

export interface RawRecapEntry {
  subjectSlug?: unknown;
  topic?: unknown;
  minutesSpent?: unknown;
  notes?: unknown;
  offPlan?: unknown;
}

export interface NormalizedRecapEntry {
  subjectSlug: ValidSubjectSlug;
  topic: string;
  minutesSpent: number;
  notes: string | null;
  offPlan: boolean;
}

/**
 * Normalize a single LLM-extracted entry. Returns null if the entry is unsalvageable.
 */
export function normalizeRecapEntry(raw: RawRecapEntry): NormalizedRecapEntry | null {
  // subjectSlug: try exact match first, then alias map, then default to "other"
  let slug: ValidSubjectSlug | null = null;
  const rawSlug = typeof raw.subjectSlug === "string" ? raw.subjectSlug.trim() : "";
  if ((VALID_SUBJECT_SLUGS as readonly string[]).includes(rawSlug)) {
    slug = rawSlug as ValidSubjectSlug;
  } else if (rawSlug in SLUG_ALIASES) {
    slug = SLUG_ALIASES[rawSlug];
  } else {
    // case-insensitive lookup
    const lower = rawSlug.toLowerCase();
    if ((VALID_SUBJECT_SLUGS as readonly string[]).includes(lower)) {
      slug = lower as ValidSubjectSlug;
    } else if (lower in SLUG_ALIASES) {
      slug = SLUG_ALIASES[lower];
    } else {
      // unknown -> mark as "other" so we don't lose the entry
      slug = "other";
    }
  }

  // topic: required, length-clamped
  let topic = typeof raw.topic === "string" ? raw.topic.trim() : "";
  if (topic.length < MIN_TOPIC_LENGTH) return null; // unsalvageable
  if (topic.length > MAX_TOPIC_LENGTH) topic = topic.slice(0, MAX_TOPIC_LENGTH);

  // minutesSpent: clamp to [0, MAX_MINUTES_PER_ENTRY]
  let minutes = 0;
  if (typeof raw.minutesSpent === "number" && Number.isFinite(raw.minutesSpent)) {
    minutes = Math.max(0, Math.min(MAX_MINUTES_PER_ENTRY, Math.floor(raw.minutesSpent)));
  } else if (typeof raw.minutesSpent === "string") {
    const n = parseInt(raw.minutesSpent, 10);
    if (Number.isFinite(n)) minutes = Math.max(0, Math.min(MAX_MINUTES_PER_ENTRY, n));
  }

  // notes: optional, length-clamped
  let notes: string | null = null;
  if (typeof raw.notes === "string" && raw.notes.trim().length > 0) {
    notes = raw.notes.trim().slice(0, 2000);
  }

  // offPlan: boolean coercion
  const offPlan = raw.offPlan === true || raw.offPlan === "true" || raw.offPlan === 1;

  return { subjectSlug: slug, topic, minutesSpent: minutes, notes, offPlan };
}

/**
 * Normalize an array of LLM-extracted entries. Drops unsalvageable ones.
 */
export function normalizeRecapEntries(rawList: unknown): NormalizedRecapEntry[] {
  if (!Array.isArray(rawList)) return [];
  const out: NormalizedRecapEntry[] = [];
  for (const r of rawList) {
    if (typeof r !== "object" || r === null) continue;
    const n = normalizeRecapEntry(r as RawRecapEntry);
    if (n) out.push(n);
  }
  return out;
}

/**
 * Detect "nothing happened today" replies so we can mark recap as replied
 * without erroring. These should not be treated as parse failures.
 */
const NOTHING_HAPPENED_PATTERNS = [
  /^nothing\b/i,
  /^we (just )?rested\b/i,
  /^(we )?took (a |the )?day off\b/i,
  /^(it was )?a sick day\b/i,
  /^(reagan )?was sick\b/i,
  /^no school\b/i,
  /^off day\b/i,
  /^skip(ped)? today\b/i,
  /^break day\b/i,
];

export function isNothingHappenedReply(replyText: string): boolean {
  if (!replyText || typeof replyText !== "string") return false;
  const trimmed = replyText.trim().slice(0, 200);
  if (trimmed.length === 0) return false;
  return NOTHING_HAPPENED_PATTERNS.some((pat) => pat.test(trimmed));
}

/**
 * Truncate replyText to safe length before storing or LLM-processing.
 */
export function clampReplyText(text: string): string {
  if (typeof text !== "string") return "";
  if (text.length <= MAX_REPLY_TEXT_LENGTH) return text;
  return text.slice(0, MAX_REPLY_TEXT_LENGTH);
}
