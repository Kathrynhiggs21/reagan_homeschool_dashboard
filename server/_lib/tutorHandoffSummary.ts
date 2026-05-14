/**
 * Push 166 (2026-05-14) — Tutor handoff summary builder.
 *
 * Mom + Grandma's rule: when Reagan has a tutor session, the tutor should
 * walk in already knowing what we covered, what's still hard, and what
 * Reagan asked for. No skimming the dashboard, no pulling up 5 tabs.
 *
 * This pure helper turns the last 7 days of school data + recent grades +
 * recent off-curriculum interests into TWO tiny outputs:
 *
 *   1. tutorBriefMarkdown — a 5-bullet markdown tutor brief that Mom can
 *      paste straight into a text/email to the tutor.
 *   2. kidLine — one plain-English sentence Reagan herself can hear from
 *      Kiwi at the start of the session ("Today with Mr. Sam we'll work
 *      on multiplication and the bird-watching project").
 *
 * Pure: no DB, no LLM, no clock dependency.
 */

export type SubjectKey = "math" | "ela" | "science" | "social-studies" | "specials";

export interface RecentGrade {
  subject: SubjectKey;
  topic: string;
  scorePct: number; // 0..100
  schoolDayISO: string; // YYYY-MM-DD
}

export interface RecentTopicCovered {
  subject: SubjectKey;
  topic: string;
  schoolDayISO: string;
  /** Marker if it was an off-plan add (Reagan-led / Mom-led off the standard list). */
  offPlan?: boolean;
}

export interface ReaganRequestRow {
  raw: string;
  subjectHint?: SubjectKey | null;
  schoolDayISO: string;
}

export interface TutorHandoffInput {
  studentName: string;
  tutorName: string;
  /** Subject the tutor handles (drives which weak topic surfaces first). */
  tutorSubject: SubjectKey;
  /** Last 7 school-days of grades. */
  recentGrades: ReadonlyArray<RecentGrade>;
  /** Last 7 school-days of topics actually covered. */
  recentTopicsCovered: ReadonlyArray<RecentTopicCovered>;
  /** Last 7 school-days of Reagan-side requests ("more bird-watching"). */
  recentRequests?: ReadonlyArray<ReaganRequestRow>;
  /** ISO of the upcoming session date. */
  sessionDayISO: string;
}

export interface TutorHandoffResult {
  studentName: string;
  tutorName: string;
  tutorSubject: SubjectKey;
  sessionDayISO: string;
  weakTopic: string | null;
  recentWinTopic: string | null;
  weakAvgPct: number | null;
  recentWinAvgPct: number | null;
  reaganInterests: string[];
  tutorBriefMarkdown: string;
  kidLine: string;
}

const SUBJECT_LABEL: Record<SubjectKey, string> = {
  math: "Math",
  ela: "Reading & Writing",
  science: "Science",
  "social-studies": "Social Studies",
  specials: "Specials",
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = nums.reduce((a, b) => a + b, 0);
  return Math.round(s / nums.length);
}

function dedupeOrdered<T>(items: T[], keyOf: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const i of items) {
    const k = keyOf(i);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}

function pickReaganInterests(reqs: ReadonlyArray<ReaganRequestRow>): string[] {
  if (!reqs || reqs.length === 0) return [];
  const stripped = reqs
    .map((r) => (r.raw ?? "").trim())
    .filter((s) => s.length > 0)
    .map((s) => s.toLowerCase().replace(/^(can we|could we|i want|i'd like|please|i would like)\s+/i, ""));
  return dedupeOrdered(stripped, (s) => s).slice(0, 3);
}

export function buildTutorHandoffSummary(input: TutorHandoffInput): TutorHandoffResult {
  if (!input || typeof input !== "object") throw new Error("buildTutorHandoffSummary: input required");
  const studentName = (input.studentName ?? "").trim() || "Reagan";
  const tutorName = (input.tutorName ?? "").trim() || "your tutor";
  if (typeof input.sessionDayISO !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.sessionDayISO)) {
    throw new Error("buildTutorHandoffSummary: sessionDayISO must be YYYY-MM-DD");
  }
  const tutorSubject = input.tutorSubject;

  // Find weak + recent-win topics in the tutor's subject.
  const subjectGrades = (input.recentGrades ?? []).filter((g) => g.subject === tutorSubject);
  const byTopic = new Map<string, number[]>();
  for (const g of subjectGrades) {
    const arr = byTopic.get(g.topic) ?? [];
    arr.push(g.scorePct);
    byTopic.set(g.topic, arr);
  }
  let weakTopic: string | null = null;
  let weakAvgPct: number | null = null;
  let recentWinTopic: string | null = null;
  let recentWinAvgPct: number | null = null;
  let lowestAvg = 101;
  let highestAvg = -1;
  for (const [t, scores] of Array.from(byTopic.entries())) {
    const a = avg(scores);
    if (a < lowestAvg) {
      lowestAvg = a;
      weakTopic = t;
      weakAvgPct = a;
    }
    if (a > highestAvg) {
      highestAvg = a;
      recentWinTopic = t;
      recentWinAvgPct = a;
    }
  }

  // Recent off-plan interests = Reagan-driven curiosity threads.
  const offPlanTopics = (input.recentTopicsCovered ?? [])
    .filter((t) => t.offPlan)
    .map((t) => t.topic);
  const reaganInterests = dedupeOrdered(
    [...pickReaganInterests(input.recentRequests ?? []), ...offPlanTopics],
    (s) => s.toLowerCase(),
  ).slice(0, 3);

  const subjectLabel = SUBJECT_LABEL[tutorSubject] ?? tutorSubject;

  const lines: string[] = [];
  lines.push(`# Tutor handoff — ${studentName} with ${tutorName} (${input.sessionDayISO})`);
  lines.push("");
  if (weakTopic && weakAvgPct !== null) {
    lines.push(`- **Focus on:** ${weakTopic} — ${studentName} is averaging ${weakAvgPct}% in ${subjectLabel}.`);
  } else if (subjectGrades.length === 0) {
    lines.push(`- **Focus on:** any ${subjectLabel} topic — no recent grades to read.`);
  } else {
    lines.push(`- **Focus on:** anything in ${subjectLabel} — recent grades are even.`);
  }
  if (recentWinTopic && recentWinAvgPct !== null && recentWinTopic !== weakTopic) {
    lines.push(`- **Recent win:** ${recentWinTopic} (${recentWinAvgPct}%). Lead with this so she starts strong.`);
  }
  // Topics covered list (last 7 days, in this subject)
  const subjectCovered = dedupeOrdered(
    (input.recentTopicsCovered ?? []).filter((t) => t.subject === tutorSubject).map((t) => t.topic),
    (s) => s.toLowerCase(),
  );
  if (subjectCovered.length > 0) {
    const list = subjectCovered.slice(0, 5).join(", ");
    lines.push(`- **Already covered this week in ${subjectLabel}:** ${list}.`);
  } else {
    lines.push(`- **Nothing covered yet this week in ${subjectLabel}.**`);
  }
  if (reaganInterests.length > 0) {
    lines.push(`- **${studentName} asked for:** ${reaganInterests.join("; ")}. If you can tie a problem to one of these, do.`);
  }
  lines.push(
    `- **Reminder:** no timers in front of ${studentName}; use plain words; if she gets frustrated, switch to the easier topic for 5 minutes and come back.`,
  );

  // Kid-line for Kiwi to read at the start of the session.
  let kidLine: string;
  if (weakTopic && reaganInterests[0]) {
    kidLine = `Today with ${tutorName} we'll work on ${weakTopic} and ${reaganInterests[0]}.`;
  } else if (weakTopic) {
    kidLine = `Today with ${tutorName} we'll work on ${weakTopic}.`;
  } else if (reaganInterests[0]) {
    kidLine = `Today with ${tutorName} we'll work on something fun — ${reaganInterests[0]}.`;
  } else {
    kidLine = `Today with ${tutorName} we'll work on ${subjectLabel}.`;
  }

  return {
    studentName,
    tutorName,
    tutorSubject,
    sessionDayISO: input.sessionDayISO,
    weakTopic,
    recentWinTopic: recentWinTopic && recentWinTopic !== weakTopic ? recentWinTopic : null,
    weakAvgPct,
    recentWinAvgPct: recentWinTopic && recentWinTopic !== weakTopic ? recentWinAvgPct : null,
    reaganInterests,
    tutorBriefMarkdown: lines.join("\n"),
    kidLine,
  };
}
