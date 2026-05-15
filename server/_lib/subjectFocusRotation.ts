/**
 * Wave-15 / Push 206 — subjectFocusRotation
 *
 * Pure deterministic helper. Given today's date (ISO) + a short history
 * of the subjects Reagan has already led with this week, returns a
 * suggested "focus subject" for today's morning block so she doesn't
 * end up doing the same subject every single morning.
 *
 * Non-negotiable house rules baked in:
 *   - Never punitive. The helper only *suggests* a focus subject; the
 *     UI must still let Reagan switch via Kiwi at any time (kidConsent
 *     signals from Push 204/205 override anything we recommend here).
 *   - Never blames Reagan. If history is empty or chaotic we just fall
 *     back to the day-of-week default and move on calmly.
 *   - Reagan does NOT directly change the schedule. This helper is a
 *     read-only recommendation surface for the Today page. Real schedule
 *     changes still flow through Mom + Grandma approval.
 *   - Voice: the adultLine / kidLine fields use the calm older-cousin
 *     tone we standardized on in the Wave-14/15 voice rewrite. No
 *     "buddy / friend / yay / great job!".
 */

export type SubjectFocusRecommendationReason =
  | "day_default"
  | "rotation_balance"
  | "history_empty"
  | "weekend_light";

export interface SubjectHistoryEntry {
  isoDate: string; // YYYY-MM-DD
  subject: string;
}

export interface SubjectFocusRecommendation {
  focusSubject: string;
  reason: SubjectFocusRecommendationReason;
  weekendLight: boolean;
  kidLine: string;
  adultLine: string;
  alternates: string[];
}

/**
 * Reagan's standard 5th-grade morning rotation. Order here is the
 * canonical day-of-week default (Mon..Fri); Sat/Sun are weekend-light.
 */
const DEFAULT_WEEKDAY_FOCUS: Record<number, string> = {
  // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  1: "Math",
  2: "Reading",
  3: "Science",
  4: "Writing",
  5: "Social Studies",
};

const DEFAULT_SUBJECT_POOL: string[] = [
  "Math",
  "Reading",
  "Science",
  "Writing",
  "Social Studies",
];

function parseIsoDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return new Date();
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d, 12, 0, 0, 0);
}

export function decideSubjectFocus(input: {
  isoDate: string;
  recentHistory?: SubjectHistoryEntry[];
  availableSubjects?: string[];
}): SubjectFocusRecommendation {
  const pool =
    input.availableSubjects && input.availableSubjects.length > 0
      ? [...input.availableSubjects]
      : [...DEFAULT_SUBJECT_POOL];

  const date = parseIsoDate(input.isoDate);
  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;

  if (isWeekend) {
    return {
      focusSubject: "Choice",
      reason: "weekend_light",
      weekendLight: true,
      kidLine: "Weekend. Pick whatever you feel like.",
      adultLine: "Weekend — no required focus block.",
      alternates: pool.slice(0, 2),
    };
  }

  const history = (input.recentHistory ?? []).slice();
  history.sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1));

  if (history.length === 0) {
    const fallback = DEFAULT_WEEKDAY_FOCUS[dow] ?? pool[0];
    return {
      focusSubject: fallback,
      reason: "history_empty",
      weekendLight: false,
      kidLine: `Today's first block: ${fallback}.`,
      adultLine: `No history on file — using day default (${fallback}).`,
      alternates: pool.filter((s) => s !== fallback).slice(0, 2),
    };
  }

  const window = history.slice(0, 7);
  const counts = new Map<string, number>();
  for (const s of pool) counts.set(s, 0);
  for (const h of window) {
    if (counts.has(h.subject)) {
      counts.set(h.subject, (counts.get(h.subject) ?? 0) + 1);
    }
  }

  const dayDefault = DEFAULT_WEEKDAY_FOCUS[dow] ?? pool[0];
  const minCount = Math.min(...Array.from(counts.values()));
  const leastDone = pool.filter((s) => counts.get(s) === minCount);

  let focus: string;
  let reason: SubjectFocusRecommendationReason;
  if (leastDone.includes(dayDefault)) {
    focus = dayDefault;
    reason = "day_default";
  } else {
    focus = leastDone[0] ?? dayDefault;
    reason = "rotation_balance";
  }

  const alternates = pool.filter((s) => s !== focus).slice(0, 2);

  return {
    focusSubject: focus,
    reason,
    weekendLight: false,
    kidLine: `Today's first block: ${focus}.`,
    adultLine:
      reason === "day_default"
        ? `Day default (${focus}).`
        : `Rotation balance — ${focus} is behind this week.`,
    alternates,
  };
}
