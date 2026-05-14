/**
 * Push 161 (2026-05-14) — Daily Mom briefing builder.
 *
 * Mom's locked rules:
 *   "AI Summaries and Progress Tracking based on Voice and Activity:
 *    The AI should include summaries of the day and assignments
 *    completed."
 *   "kid + Grandma readable + automation-by-default + sync-everywhere"
 *
 * Goal: bundle three already-generated pieces of the day into ONE
 * plain-English email body Mom can read in 10 seconds:
 *
 *   1) Today's kid summary (`buildDailyKidSummary`).
 *   2) Reagan's mood roll-up (`rollUpDayMood`).
 *   3) Planned vs Actual delta + extra-topics + worksheet count.
 *
 * Pure: no DB, no LLM, no clock dependency.
 */

import {
  buildDailyKidSummary,
  type DailyKidSummary,
  type DailyKidSummaryInput,
} from "./dailyKidSummary";
import {
  rollUpDayMood,
  type KiwiDayMood,
  type KiwiMoodReading,
  type MoodBand,
} from "./kiwiMoodTracker";

export interface DailyMomBriefingInput {
  /** ISO date for the school day, e.g., "2026-05-14". */
  schoolDayISO: string;
  /** Reagan's first name. */
  kidName: string;
  /** Auto-graded submissions for the day (passed to dailyKidSummary). */
  grades: DailyKidSummaryInput["grades"];
  /** Per-subject minutes-on-task derived from block durations + actual logs. */
  timeBySubjectMin: Record<string, number>;
  /** Total time-on-task across the day, in minutes. */
  totalMinutesOnTask: number;
  /** Total minutes Mom planned for the day. */
  totalMinutesPlanned: number;
  /** Optional: books worked on today, surfaced in kid summary. */
  booksRead?: ReadonlyArray<{ bookTitle: string; pages: number }>;
  /** Per-block Kiwi readings for the school day, in chronological order. */
  moodReadings: readonly KiwiMoodReading[];
  /** Optional: extra topics Reagan covered that aren't on her curriculum. */
  extraTopicsCovered?: ReadonlyArray<{ subject: string; label: string }>;
  /** Optional: worksheet PDFs auto-attached to tonight's email. */
  worksheetsAttached?: number;
}

export interface DailyMomBriefing {
  schoolDayISO: string;
  /** Markdown body for the 8 PM email. */
  markdownBody: string;
  /** One-line phone notification body. */
  notificationHeadline: string;
  /** Mood roll-up we used (so caller can persist for analytics). */
  moodRollup: KiwiDayMood;
  /** Kid summary we used (so caller can re-use). */
  kidSummary: DailyKidSummary;
  /** Planned vs Actual delta block (already kid-readable). */
  plannedVsActualLine: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function plannedVsActualLine(planned: number, actual: number): string {
  const p = Math.max(0, Math.round(planned));
  const a = Math.max(0, Math.round(actual));
  if (p === 0 && a === 0) return "Planned vs actual: nothing logged today yet.";
  if (p === 0) return `Planned vs actual: ${a} min logged today (no plan was set).`;
  if (a === 0) return `Planned vs actual: ${p} min planned, but nothing was logged today yet.`;
  const delta = a - p;
  if (delta === 0) return `Planned vs actual: ${p} min planned, ${a} min done — right on plan.`;
  if (delta > 0) return `Planned vs actual: ${p} min planned, ${a} min done — went ${delta} min over.`;
  return `Planned vs actual: ${p} min planned, ${a} min done — ${Math.abs(delta)} min short of plan.`;
}

function moodLine(mood: KiwiDayMood): string {
  const band: MoodBand = mood.band;
  switch (band) {
    case "great": return `Reagan's mood today: great.`;
    case "okay": return `Reagan's mood today: okay.`;
    case "tired": return `Reagan's mood today: tired — go gentle tomorrow.`;
    case "frustrated": return `Reagan's mood today: frustrated — worth a check-in.`;
    default: return `Reagan's mood today: ${band}.`;
  }
}

function extraTopicsLine(
  extras: ReadonlyArray<{ subject: string; label: string }> | undefined,
): string {
  if (!extras || extras.length === 0) return "";
  const head = extras.length === 1 ? "Extra topic covered today:" : "Extra topics covered today:";
  const lines = extras.map((t) => `- ${t.label} (${t.subject})`);
  return `${head}\n${lines.join("\n")}`;
}

function worksheetLine(n: number | undefined): string {
  if (typeof n !== "number" || n <= 0) return "";
  if (n === 1) return "1 worksheet printable is attached to this email.";
  return `${n} worksheet printables are attached to this email.`;
}

function buildHeadline(
  schoolDayISO: string,
  kidSummary: DailyKidSummary,
  mood: KiwiDayMood,
  planned: number,
  actual: number,
): string {
  const p = Math.max(0, Math.round(planned));
  const a = Math.max(0, Math.round(actual));
  const minutesHint = p === 0 && a === 0 ? "" : ` ${a}/${p} min.`;
  const moodHint = ` Mood: ${mood.band}.`;
  return `Reagan's day — ${schoolDayISO}: ${kidSummary.headline}.${minutesHint}${moodHint}`.trim();
}

export function buildDailyMomBriefing(input: DailyMomBriefingInput): DailyMomBriefing {
  if (typeof input?.schoolDayISO !== "string" || !ISO_DATE_RE.test(input.schoolDayISO)) {
    throw new Error("buildDailyMomBriefing: schoolDayISO must be YYYY-MM-DD");
  }
  if (typeof input.kidName !== "string" || input.kidName.trim().length === 0) {
    throw new Error("buildDailyMomBriefing: kidName must be a non-empty string");
  }

  const kidSummary = buildDailyKidSummary({
    forDate: input.schoolDayISO,
    studentName: input.kidName,
    grades: input.grades,
    timeBySubjectMin: input.timeBySubjectMin,
    booksRead: input.booksRead ? [...input.booksRead] : undefined,
  });
  const moodRollup = rollUpDayMood([...input.moodReadings]);
  const pVa = plannedVsActualLine(input.totalMinutesPlanned, input.totalMinutesOnTask);
  const moodLn = moodLine(moodRollup);
  const extras = extraTopicsLine(input.extraTopicsCovered);
  const worksheets = worksheetLine(input.worksheetsAttached);

  const sections: string[] = [
    `# Reagan's day — ${input.schoolDayISO}`,
    "",
    kidSummary.headline,
  ];
  if (kidSummary.perSubjectLines.length > 0) {
    sections.push("");
    for (const line of kidSummary.perSubjectLines) sections.push(`- ${line}`);
  }
  if (kidSummary.grandmaLine) {
    sections.push("", kidSummary.grandmaLine);
  }
  sections.push("", pVa, "", moodLn);
  if (moodRollup.suggestion) {
    sections.push("", `Suggestion: ${moodRollup.suggestion}`);
  }
  if (extras) sections.push("", extras);
  if (worksheets) sections.push("", worksheets);

  const markdownBody = sections.join("\n");
  const notificationHeadline = buildHeadline(
    input.schoolDayISO,
    kidSummary,
    moodRollup,
    input.totalMinutesPlanned,
    input.totalMinutesOnTask,
  );

  return {
    schoolDayISO: input.schoolDayISO,
    markdownBody,
    notificationHeadline,
    moodRollup,
    kidSummary,
    plannedVsActualLine: pVa,
  };
}
