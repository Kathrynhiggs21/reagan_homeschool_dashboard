/**
 * Push 167 (2026-05-14) — Subject-time-balance live alert helper.
 *
 * Mom's rule: across a 5-day school week, Reagan should hit roughly the
 * weekly target minutes per subject. If by mid-week one subject is way
 * behind (or one is hogging the week), an adult-side notice should
 * surface — gentle, not bossy, plain English, no "deficit %".
 *
 * Pure helper: no DB, no LLM, no clock dependency.
 *
 *   computeSubjectTimeBalanceAlert(input)
 *     -> { subjects: [...], notices: [...], adultLine: string, kidLine: string }
 *
 * Inputs:
 *   - weekStartISO              (Mon)
 *   - schoolDaysElapsedThisWeek (0..5; 0 = nothing yet, 5 = whole week done)
 *   - actualMinByDay            { subject: minutesSoFarThisWeek }
 *   - weeklyTargetMin           { subject: weeklyTargetMin }
 *
 * Notices fire when:
 *   - "behind"  : subject is at < 60 % of its proportional pacing
 *                 (proportional = weeklyTarget * elapsed/5)  AND has at
 *                 least 30 min target this week
 *   - "ahead"   : > 140 % of proportional pacing AND elapsed >= 2
 *   - "missing" : 0 minutes AND elapsed >= 3 AND weeklyTarget > 0
 */

export type SubjectKey = "math" | "ela" | "science" | "social-studies" | "specials";

const SUBJECT_LABEL: Record<SubjectKey, string> = {
  math: "Math",
  ela: "Reading & Writing",
  science: "Science",
  "social-studies": "Social Studies",
  specials: "Specials",
};

export interface SubjectTimeBalanceInput {
  weekStartISO: string; // YYYY-MM-DD (Mon)
  /** 0..5; how many of the 5 weekday school days have already happened. */
  schoolDaysElapsedThisWeek: number;
  /** Minutes Reagan has done in each subject so far this week. */
  actualMinByDay: Partial<Record<SubjectKey, number>>;
  /** Weekly target minutes per subject (0 means no target). */
  weeklyTargetMin: Partial<Record<SubjectKey, number>>;
}

export type NoticeKind = "behind" | "ahead" | "missing";

export interface SubjectBalanceRow {
  subject: SubjectKey;
  label: string;
  actualMin: number;
  weeklyTargetMin: number;
  proportionalTargetMin: number;
  pacingPct: number; // actual / proportional, 0..200 capped
  noticeKind: NoticeKind | null;
  noticeText: string | null;
}

export interface SubjectTimeBalanceAlertResult {
  weekStartISO: string;
  schoolDaysElapsedThisWeek: number;
  subjects: SubjectBalanceRow[];
  notices: { subject: SubjectKey; kind: NoticeKind; text: string }[];
  /** Adult-side one-liner ("Heads up: Science is behind this week."). */
  adultLine: string;
  /** Kid-side one-liner Kiwi can read ("Let's pick a science block today."). */
  kidLine: string;
}

const SUBJECT_ORDER: SubjectKey[] = ["math", "ela", "science", "social-studies", "specials"];

function subjectFriendlyForKid(s: SubjectKey): string {
  switch (s) {
    case "math": return "math";
    case "ela": return "reading or writing";
    case "science": return "science";
    case "social-studies": return "social studies";
    case "specials": return "art or specials";
  }
}

export function computeSubjectTimeBalanceAlert(input: SubjectTimeBalanceInput): SubjectTimeBalanceAlertResult {
  if (!input || typeof input !== "object") throw new Error("computeSubjectTimeBalanceAlert: input required");
  if (typeof input.weekStartISO !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.weekStartISO)) {
    throw new Error("computeSubjectTimeBalanceAlert: weekStartISO must be YYYY-MM-DD");
  }
  const elapsed = Math.max(0, Math.min(5, Math.floor(input.schoolDaysElapsedThisWeek ?? 0)));

  const subjects: SubjectBalanceRow[] = [];
  const notices: { subject: SubjectKey; kind: NoticeKind; text: string }[] = [];

  for (const subj of SUBJECT_ORDER) {
    const actual = Math.max(0, Math.round(input.actualMinByDay?.[subj] ?? 0));
    const target = Math.max(0, Math.round(input.weeklyTargetMin?.[subj] ?? 0));
    const proportional = elapsed === 0 ? 0 : Math.round((target * elapsed) / 5);
    const pacing = proportional === 0 ? (target === 0 ? 100 : 0) : Math.min(200, Math.round((actual * 100) / proportional));

    let kind: NoticeKind | null = null;
    let text: string | null = null;
    const label = SUBJECT_LABEL[subj];
    if (target >= 30 && elapsed >= 1 && actual === 0 && elapsed >= 3) {
      kind = "missing";
      text = `${label} hasn't been touched yet this week.`;
    } else if (target >= 30 && elapsed >= 1 && pacing < 60 && proportional > 0) {
      kind = "behind";
      text = `${label} is behind this week — about ${actual} of ${target} target minutes done.`;
    } else if (elapsed >= 2 && pacing > 140 && target > 0) {
      kind = "ahead";
      text = `${label} is way ahead of pace this week — ${actual} minutes done vs ${target} weekly target.`;
    }

    subjects.push({
      subject: subj,
      label,
      actualMin: actual,
      weeklyTargetMin: target,
      proportionalTargetMin: proportional,
      pacingPct: pacing,
      noticeKind: kind,
      noticeText: text,
    });
    if (kind && text) notices.push({ subject: subj, kind, text });
  }

  // Build adult line — prefer missing, then behind, then ahead.
  const missing = notices.filter((n) => n.kind === "missing").map((n) => SUBJECT_LABEL[n.subject]);
  const behind = notices.filter((n) => n.kind === "behind").map((n) => SUBJECT_LABEL[n.subject]);
  const ahead = notices.filter((n) => n.kind === "ahead").map((n) => SUBJECT_LABEL[n.subject]);

  let adultLine = "Looks balanced this week.";
  if (missing.length > 0) {
    adultLine = `Heads up: ${missing.join(", ")} hasn't been touched this week.`;
  } else if (behind.length > 0) {
    adultLine = `Heads up: ${behind.join(", ")} ${behind.length === 1 ? "is" : "are"} behind this week.`;
  } else if (ahead.length > 0) {
    adultLine = `Nice — ${ahead.join(", ")} ${ahead.length === 1 ? "is" : "are"} ahead this week.`;
  }

  // Kid line — pick the first behind/missing subject and gently nudge.
  let kidLine = "Your week is looking even — pick whatever feels good!";
  const firstBehind = notices.find((n) => n.kind === "behind" || n.kind === "missing");
  if (firstBehind) {
    kidLine = `Want to pick a ${subjectFriendlyForKid(firstBehind.subject)} block today?`;
  } else if (ahead.length > 0 && missing.length === 0 && behind.length === 0) {
    kidLine = "Great pace this week!";
  }

  return {
    weekStartISO: input.weekStartISO,
    schoolDaysElapsedThisWeek: elapsed,
    subjects,
    notices,
    adultLine,
    kidLine,
  };
}
