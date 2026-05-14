/**
 * Push 169 (2026-05-15 overnight Wave-10) — Kid-readable streak helper.
 *
 * Mom's rule: never make Reagan feel bad for breaking a streak. The
 * helper celebrates streaks gently and reframes a missed day as
 * "first day back, nice" — never "you broke your streak."
 *
 * Pure helper: no DB, no LLM, no clock dependency.
 *
 *   computeKidStreaks(input)
 *     -> { perSubject: [...], headlineLine: string, kindCount: number }
 *
 * Inputs:
 *   - todayISO        (YYYY-MM-DD)
 *   - lookbackDays    (number; default 14)
 *   - dailyByDate     { "YYYY-MM-DD": { subject: minutesDoneThatDay } }
 *   - subjects        (optional explicit list; default 5 canonical)
 *
 * Streak rules:
 *   - "in a row" = consecutive school days (Mon-Fri) with >= 1 minute
 *     of that subject; weekend days don't break the streak (skipped).
 *   - "first day back" = today has work but yesterday-school-day did
 *     not, and there's some history >= 7 days ago.
 *   - "kindness" lines never use "broken" or "lost".
 */

export type SubjectKey = "math" | "ela" | "science" | "social-studies" | "specials";

const SUBJECT_LABEL: Record<SubjectKey, string> = {
  math: "Math",
  ela: "Reading & Writing",
  science: "Science",
  "social-studies": "Social Studies",
  specials: "Specials",
};

const DEFAULT_SUBJECTS: SubjectKey[] = ["math", "ela", "science", "social-studies", "specials"];

export interface KidStreakInput {
  todayISO: string;
  lookbackDays?: number;
  dailyByDate: Record<string, Partial<Record<SubjectKey, number>>>;
  subjects?: SubjectKey[];
}

export interface SubjectStreakRow {
  subject: SubjectKey;
  label: string;
  daysInARow: number;
  isFirstDayBack: boolean;
  kidLine: string;
}

export interface KidStreakResult {
  todayISO: string;
  lookbackDays: number;
  perSubject: SubjectStreakRow[];
  /** Best one-liner to surface on Today (longest streak wins; first-day-back beats 0). */
  headlineLine: string;
  /** How many "kind" lines were generated (always >= 1). */
  kindCount: number;
}

function isWeekday(iso: string): boolean {
  const d = new Date(iso + "T00:00:00Z");
  const dow = d.getUTCDay();
  return dow >= 1 && dow <= 5;
}

function shiftIso(iso: string, deltaDays: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function previousSchoolDay(iso: string): string {
  let d = shiftIso(iso, -1);
  while (!isWeekday(d)) d = shiftIso(d, -1);
  return d;
}

function streakDaysBackFromToday(
  subject: SubjectKey,
  todayISO: string,
  daily: KidStreakInput["dailyByDate"],
  lookbackDays: number,
): number {
  let cursor = todayISO;
  let count = 0;
  let walked = 0;
  while (walked < lookbackDays) {
    if (isWeekday(cursor)) {
      const min = daily[cursor]?.[subject] ?? 0;
      if (min >= 1) count++;
      else break;
    }
    cursor = shiftIso(cursor, -1);
    walked++;
  }
  return count;
}

function isFirstDayBack(
  subject: SubjectKey,
  todayISO: string,
  daily: KidStreakInput["dailyByDate"],
  lookbackDays: number,
): boolean {
  if (!isWeekday(todayISO)) return false;
  const todayMin = daily[todayISO]?.[subject] ?? 0;
  if (todayMin < 1) return false;

  const prev = previousSchoolDay(todayISO);
  const prevMin = daily[prev]?.[subject] ?? 0;
  if (prevMin >= 1) return false;

  // need history >= 7 days ago
  for (let back = 7; back <= lookbackDays; back++) {
    const iso = shiftIso(todayISO, -back);
    const min = daily[iso]?.[subject] ?? 0;
    if (min >= 1) return true;
  }
  return false;
}

function streakLine(label: string, days: number): string {
  if (days <= 0) return "";
  if (days === 1) return `${label} today — nice start.`;
  if (days === 2) return `Two days in a row of ${label}!`;
  if (days < 5) return `${days} days in a row of ${label}!`;
  if (days < 10) return `${days} days in a row of ${label} — wow.`;
  return `${days} days in a row of ${label} — you're on fire.`;
}

function firstDayBackLine(label: string): string {
  return `First day back to ${label} — nice.`;
}

export function computeKidStreaks(input: KidStreakInput): KidStreakResult {
  if (!input || typeof input !== "object") throw new Error("computeKidStreaks: input required");
  if (typeof input.todayISO !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.todayISO)) {
    throw new Error("computeKidStreaks: todayISO must be YYYY-MM-DD");
  }
  const lookbackDays = Math.max(1, Math.min(60, Math.floor(input.lookbackDays ?? 14)));
  const daily = input.dailyByDate ?? {};
  const subjects = input.subjects ?? DEFAULT_SUBJECTS;

  const perSubject: SubjectStreakRow[] = subjects.map((subject) => {
    const label = SUBJECT_LABEL[subject];
    const days = streakDaysBackFromToday(subject, input.todayISO, daily, lookbackDays);
    const fdb = days === 1 && isFirstDayBack(subject, input.todayISO, daily, lookbackDays);
    let kidLine = "";
    if (fdb) kidLine = firstDayBackLine(label);
    else if (days >= 1) kidLine = streakLine(label, days);
    return { subject, label, daysInARow: days, isFirstDayBack: fdb, kidLine };
  });

  // Headline: longest streak wins; ties go to first canonical order.
  // First-day-back beats 0-streak but loses to any real streak >= 2.
  let headline = "Welcome back — pick anywhere to start.";
  let kindCount = 1;

  const realStreaks = perSubject.filter((r) => r.daysInARow >= 2);
  if (realStreaks.length > 0) {
    const best = realStreaks.reduce((a, b) => (b.daysInARow > a.daysInARow ? b : a));
    headline = best.kidLine;
    kindCount = realStreaks.length;
  } else {
    const fdb = perSubject.find((r) => r.isFirstDayBack);
    if (fdb) {
      headline = fdb.kidLine;
      kindCount = 1;
    } else {
      const anyToday = perSubject.find((r) => r.daysInARow >= 1);
      if (anyToday) {
        headline = anyToday.kidLine;
        kindCount = 1;
      }
    }
  }

  return {
    todayISO: input.todayISO,
    lookbackDays,
    perSubject,
    headlineLine: headline,
    kindCount,
  };
}
