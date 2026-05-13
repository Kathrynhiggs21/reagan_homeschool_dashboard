/**
 * Push 119 (2026-05-13) — Calendar-week assignment summary helper.
 *
 * Pure aggregator that summarizes a calendar week's worth of assignment
 * rows for the Mom-tier "This Week" view and for the Sunday digest.
 * Reports per-subject coverage and surfaces missing-day signals so the
 * recap-email composer (Push 95/110) can decide whether to nudge.
 *
 * "Missing-day" signal: a school day (Mon–Fri inside the week) that has
 * zero completed-or-in-progress assignments across all canonical subjects.
 *
 * Pure module — no DB, no I/O.
 */

export type CanonicalSubject =
  | "math"
  | "ela"
  | "science"
  | "social-studies"
  | "spelling";

export type AssignmentStatus =
  | "completed"
  | "in-progress"
  | "missed"
  | "skipped"
  | "scheduled";

export interface AssignmentRow {
  /** YYYY-MM-DD in the family timezone. */
  dateIso: string;
  subject: CanonicalSubject | string;
  status: AssignmentStatus | string;
  /** Optional minutes spent (informational). */
  minutes?: number;
}

export interface PerSubjectCoverage {
  subject: CanonicalSubject;
  completed: number;
  inProgress: number;
  missed: number;
  /** Number of distinct dates within the week with completed-or-in-progress entries. */
  daysWithWork: number;
  totalMinutes: number;
}

export interface CalendarWeekSummary {
  weekStartIso: string; // YYYY-MM-DD (Mon)
  weekEndIso: string; // YYYY-MM-DD (Sun)
  /** Total minutes across completed + in-progress entries. */
  totalMinutes: number;
  perSubject: PerSubjectCoverage[];
  /** Mon–Fri days with no completed/in-progress entry, in the week. */
  missingSchoolDays: string[];
  /** Subjects (canonical) that had zero completed-or-in-progress. */
  uncoveredSubjects: CanonicalSubject[];
  /** Mom-friendly headline for the digest body composer. */
  headline: string;
}

const CANONICAL_SUBJECTS: CanonicalSubject[] = [
  "math",
  "ela",
  "science",
  "social-studies",
  "spelling",
];

const STATUS_SET = new Set<AssignmentStatus>([
  "completed",
  "in-progress",
  "missed",
  "skipped",
  "scheduled",
]);

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(
    dt.getUTCDate(),
  )}`;
}

function dayOfWeekUtc(ymd: string): number {
  // 0 = Sunday … 6 = Saturday
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function pickHeadline(args: {
  totalMinutes: number;
  uncoveredSubjects: number;
  missingDays: number;
}): string {
  if (args.totalMinutes === 0) return "Quiet week — no logged work";
  if (args.missingDays >= 3) return "Light week — three or more days unlogged";
  if (args.uncoveredSubjects >= 3) return "Narrow week — most subjects untouched";
  if (args.uncoveredSubjects >= 1) return "Mostly-balanced week — a subject gap";
  return "Balanced week — every subject got time";
}

export function summarizeCalendarWeek(input: {
  /** Monday of the calendar week, YYYY-MM-DD. */
  weekStartIso: string;
  rows: ReadonlyArray<AssignmentRow>;
}): CalendarWeekSummary {
  const weekStart = isYmd(input?.weekStartIso) ? input.weekStartIso : "";
  const weekEnd = weekStart ? ymdAddDays(weekStart, 6) : "";

  // Build the set of dates in the week.
  const weekDates = new Set<string>();
  if (weekStart) {
    for (let i = 0; i < 7; i++) {
      weekDates.add(ymdAddDays(weekStart, i));
    }
  }

  // Per-subject + per-day accumulators, only for in-week rows.
  const subjAcc: Record<CanonicalSubject, PerSubjectCoverage> =
    Object.fromEntries(
      CANONICAL_SUBJECTS.map((s) => [
        s,
        {
          subject: s,
          completed: 0,
          inProgress: 0,
          missed: 0,
          daysWithWork: 0,
          totalMinutes: 0,
        },
      ]),
    ) as Record<CanonicalSubject, PerSubjectCoverage>;

  // Track distinct days-with-work per subject via Set.
  const subjDaySets: Record<CanonicalSubject, Set<string>> =
    Object.fromEntries(
      CANONICAL_SUBJECTS.map((s) => [s, new Set<string>()]),
    ) as Record<CanonicalSubject, Set<string>>;

  // Days (any subject) with completed-or-in-progress entries.
  const daysWithAnyWork = new Set<string>();
  let totalMinutes = 0;

  if (Array.isArray(input?.rows) && weekStart) {
    for (const r of input.rows) {
      if (!r || typeof r !== "object") continue;
      if (!isYmd(r.dateIso) || !weekDates.has(r.dateIso)) continue;
      const subject = String(r.subject ?? "").toLowerCase() as CanonicalSubject;
      if (!CANONICAL_SUBJECTS.includes(subject)) continue;
      const status = String(r.status ?? "").toLowerCase() as AssignmentStatus;
      if (!STATUS_SET.has(status)) continue;
      const acc = subjAcc[subject];
      const minutes =
        Number.isFinite(r.minutes) && (r.minutes as number) > 0
          ? Math.floor(r.minutes as number)
          : 0;

      if (status === "completed") {
        acc.completed++;
        acc.totalMinutes += minutes;
        totalMinutes += minutes;
        subjDaySets[subject].add(r.dateIso);
        daysWithAnyWork.add(r.dateIso);
      } else if (status === "in-progress") {
        acc.inProgress++;
        acc.totalMinutes += minutes;
        totalMinutes += minutes;
        subjDaySets[subject].add(r.dateIso);
        daysWithAnyWork.add(r.dateIso);
      } else if (status === "missed") {
        acc.missed++;
      }
      // "skipped" and "scheduled" are ignored for coverage signals.
    }
  }

  for (const s of CANONICAL_SUBJECTS) {
    subjAcc[s].daysWithWork = subjDaySets[s].size;
  }

  // Missing school days = Mon-Fri in week with no any-work entries.
  const missingSchoolDays: string[] = [];
  if (weekStart) {
    for (let i = 0; i < 7; i++) {
      const d = ymdAddDays(weekStart, i);
      const dow = dayOfWeekUtc(d);
      const isSchoolDay = dow >= 1 && dow <= 5;
      if (isSchoolDay && !daysWithAnyWork.has(d)) {
        missingSchoolDays.push(d);
      }
    }
  }

  const uncoveredSubjects = CANONICAL_SUBJECTS.filter(
    (s) => subjAcc[s].completed === 0 && subjAcc[s].inProgress === 0,
  );

  const headline = pickHeadline({
    totalMinutes,
    uncoveredSubjects: uncoveredSubjects.length,
    missingDays: missingSchoolDays.length,
  });

  return {
    weekStartIso: weekStart,
    weekEndIso: weekEnd,
    totalMinutes,
    perSubject: CANONICAL_SUBJECTS.map((s) => subjAcc[s]),
    missingSchoolDays,
    uncoveredSubjects,
    headline,
  };
}
