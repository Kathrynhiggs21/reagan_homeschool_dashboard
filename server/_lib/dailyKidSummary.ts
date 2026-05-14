/**
 * Overnight push 2026-05-14 — kid + Grandma readable daily summary helper.
 *
 * Mom's rule: "everything needs to be simple to a kid can understand it all
 * and my mom who is computer illiterate". The existing analytics dashboard
 * surfaces graphs + percentages, which Grandma can't read. This helper turns
 * the same numbers into ONE plain-English sentence per subject + ONE overall
 * praise line, suitable for the Today page header strip and the nightly
 * email body.
 *
 * Pure: no DB / no IO. Caller passes already-rolled-up grades + minutes.
 */

export interface DailyKidSummaryInput {
  forDate: string;           // YYYY-MM-DD
  studentName: string;       // "Reagan"
  /** Auto-graded submissions for the day. */
  grades: Array<{
    subjectName: string;     // "Math", "Reading", ...
    autoScore: number;       // 0..100
    title?: string | null;   // "Place Value Practice"
  }>;
  /** Per-subject minutes-on-task derived from block durations + actual logs. */
  timeBySubjectMin: Record<string, number>;
  /** Books worked on today (for a friendly "you read X" line). */
  booksRead?: Array<{ bookTitle: string; pages: number }>;
}

export interface DailyKidSummary {
  /** One short, kid-readable headline (under 70 chars). */
  headline: string;
  /** One sentence per subject, in subject order. */
  perSubjectLines: string[];
  /** A single Grandma-friendly praise line; empty if no graded work yet. */
  grandmaLine: string;
  /** Aggregates Mom-mode UI can show as small chips. */
  totals: {
    averageScore: number | null;
    minutesTotal: number;
    subjectsCovered: number;
    pagesRead: number;
  };
}

function band(score: number): "great" | "solid" | "tricky" {
  if (score >= 90) return "great";
  if (score >= 75) return "solid";
  return "tricky";
}

function avgByKey<T>(rows: T[], pick: (r: T) => number): number | null {
  if (rows.length === 0) return null;
  const sum = rows.reduce((s, r) => s + pick(r), 0);
  return Math.round(sum / rows.length);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function buildDailyKidSummary(input: DailyKidSummaryInput): DailyKidSummary {
  const grades = input.grades.filter((g) => Number.isFinite(g.autoScore));

  // Per-subject roll-up.
  const bySubject = new Map<
    string,
    { scores: number[]; titles: Set<string>; minutes: number }
  >();
  for (const g of grades) {
    const key = g.subjectName.trim();
    if (!key) continue;
    const cur = bySubject.get(key) ?? {
      scores: [],
      titles: new Set<string>(),
      minutes: 0,
    };
    cur.scores.push(g.autoScore);
    if (g.title) cur.titles.add(g.title);
    bySubject.set(key, cur);
  }
  // Inject minutes for every subject we know about (graded or not).
  for (const [subject, mins] of Object.entries(input.timeBySubjectMin)) {
    const cur = bySubject.get(subject) ?? {
      scores: [],
      titles: new Set<string>(),
      minutes: 0,
    };
    cur.minutes = Math.max(0, Math.round(mins));
    bySubject.set(subject, cur);
  }

  // Per-subject sentences in alphabetical-ish order (stable for tests).
  const perSubjectLines: string[] = [];
  const subjectKeys = Array.from(bySubject.keys()).sort();
  for (const subject of subjectKeys) {
    const v = bySubject.get(subject)!;
    const avg = avgByKey(v.scores, (s) => s);
    const minsLabel = v.minutes > 0 ? ` for ${plural(v.minutes, "minute", "minutes")}` : "";
    if (avg == null && v.minutes > 0) {
      perSubjectLines.push(`${subject}: worked${minsLabel}.`);
    } else if (avg == null) {
      perSubjectLines.push(`${subject}: nothing turned in yet.`);
    } else {
      const word =
        band(avg) === "great"
          ? "did great"
          : band(avg) === "solid"
            ? "did well"
            : "found some parts tricky";
      perSubjectLines.push(`${subject}: ${word}${minsLabel}.`);
    }
  }

  const overallAvg = avgByKey(grades, (g) => g.autoScore);
  const minutesTotal = Math.max(
    0,
    Math.round(
      Object.values(input.timeBySubjectMin).reduce((s, n) => s + (n || 0), 0),
    ),
  );
  const subjectsCovered = bySubject.size;
  const pagesRead = (input.booksRead ?? []).reduce(
    (s, b) => s + Math.max(0, b.pages | 0),
    0,
  );

  // Headline tries to be warm + factual.
  let headline: string;
  if (grades.length === 0 && minutesTotal === 0) {
    headline = `${input.studentName} hasn't started yet today.`;
  } else if (grades.length === 0) {
    headline = `${input.studentName} worked for ${plural(minutesTotal, "minute", "minutes")} today.`;
  } else {
    const word =
      band(overallAvg ?? 0) === "great"
        ? "had a great day"
        : band(overallAvg ?? 0) === "solid"
          ? "had a solid day"
          : "had a hard day but kept going";
    headline = `${input.studentName} ${word}.`;
  }
  if (headline.length > 70) headline = headline.slice(0, 67) + "...";

  // Grandma line: at most one sentence, only if we actually graded work.
  let grandmaLine = "";
  if (grades.length > 0) {
    const greats = grades.filter((g) => band(g.autoScore) === "great");
    const tricky = grades.filter((g) => band(g.autoScore) === "tricky");
    if (greats.length > 0) {
      const subj = greats[0].subjectName;
      grandmaLine = `Tell ${input.studentName} you noticed she did great in ${subj}.`;
    } else if (tricky.length > 0) {
      const subj = tricky[0].subjectName;
      grandmaLine = `Ask ${input.studentName} what was tricky about ${subj} today.`;
    } else {
      grandmaLine = `Tell ${input.studentName} you're proud she kept at it today.`;
    }
  }

  return {
    headline,
    perSubjectLines,
    grandmaLine,
    totals: {
      averageScore: overallAvg,
      minutesTotal,
      subjectsCovered,
      pagesRead,
    },
  };
}
