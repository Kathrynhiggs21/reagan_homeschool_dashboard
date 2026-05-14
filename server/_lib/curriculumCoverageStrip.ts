/**
 * Push 123 (2026-05-13) — Curriculum-coverage strip percent helper.
 *
 * Pure module. Powers the small "this week's coverage" strip on the
 * adult Analytics view: per-subject % of planned topics that have at
 * least one logged minute, with a rolling 7-day window.
 *
 * Product rules locked here:
 *   - Canonical academic subjects only. morning_vibe ("Slay Charge ⚡")
 *     is NEVER counted as planned or covered — it isn't a subject and
 *     it isn't an assignment.
 *   - A topic counts as "covered" if there's a row whose minutes > 0
 *     AND whose status is completed or in-progress.
 *   - Missed / skipped / scheduled rows do not count toward coverage,
 *     so an unworked plan stays at 0% even if Reagan said "no" to it.
 *   - Out-of-window rows are silently dropped (window is 7 days back
 *     from `nowMs`, inclusive on the floor day).
 *   - Empty plan returns coveredPct = 0 with status = "no-plan" so the
 *     UI can hide the chip rather than show a misleading 0%.
 *   - Status bands: 0–24% red, 25–59% amber, 60–84% on-track,
 *     85–100% strong. These are the same bands the Sunday digest
 *     uses so the UI and the email never disagree.
 */

export const CANONICAL_SUBJECTS = [
  "math",
  "ela",
  "science",
  "social-studies",
  "spelling",
] as const;

export type CanonicalSubject = (typeof CANONICAL_SUBJECTS)[number];

export type CoverageBand = "no-plan" | "red" | "amber" | "on-track" | "strong";

export interface PlannedTopic {
  /** Stable topic id from the curriculum. */
  id: string;
  subject: string;
  /** Block type — morning_vibe topics are excluded entirely. */
  blockType?: string;
}

export interface CoverageRow {
  topicId: string;
  /** UNIX ms when this work was logged. */
  loggedAtMs: number;
  status: string;
  minutes?: number;
}

export interface SubjectCoverage {
  subject: CanonicalSubject;
  plannedCount: number;
  coveredCount: number;
  coveredPct: number; // 0..100, integer
  band: CoverageBand;
}

export interface CurriculumCoverageStrip {
  /** UNIX ms floor of the 7-day window. */
  windowStartMs: number;
  /** UNIX ms used as "now" for the window. */
  windowEndMs: number;
  perSubject: SubjectCoverage[];
  /** Overall % across all canonical subjects (planned-weighted). */
  overallPct: number;
  overallBand: CoverageBand;
  /** Subjects with a plan but 0 coverage this week. */
  zeroCoverageSubjects: CanonicalSubject[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;

function isCanonicalSubject(s: unknown): s is CanonicalSubject {
  return (
    typeof s === "string" &&
    (CANONICAL_SUBJECTS as readonly string[]).includes(s)
  );
}

function bandFor(plannedCount: number, pct: number): CoverageBand {
  if (plannedCount <= 0) return "no-plan";
  if (pct < 25) return "red";
  if (pct < 60) return "amber";
  if (pct < 85) return "on-track";
  return "strong";
}

function floorToDayMs(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

function isCoveringStatus(s: unknown): boolean {
  return s === "completed" || s === "in-progress";
}

export interface BuildCoverageInput {
  planned: PlannedTopic[];
  rows: CoverageRow[];
  /** Current time in UNIX ms (injected for determinism). */
  nowMs: number;
}

export function buildCurriculumCoverageStrip(
  input: BuildCoverageInput,
): CurriculumCoverageStrip {
  const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : 0;
  const windowEndMs = nowMs;
  const windowStartMs = floorToDayMs(nowMs - (WINDOW_DAYS - 1) * DAY_MS);

  // Drop morning_vibe + non-canonical-subject topics from the plan.
  const planByTopic = new Map<string, CanonicalSubject>();
  const planCountBySubject = new Map<CanonicalSubject, number>();
  for (const subj of CANONICAL_SUBJECTS) planCountBySubject.set(subj, 0);

  for (const t of input.planned ?? []) {
    if (!t || typeof t !== "object") continue;
    if (typeof t.id !== "string" || t.id.length === 0) continue;
    if (t.blockType === "morning_vibe" || t.blockType === "morning_warmup") {
      continue;
    }
    if (!isCanonicalSubject(t.subject)) continue;
    if (planByTopic.has(t.id)) continue; // dedupe by id
    planByTopic.set(t.id, t.subject);
    planCountBySubject.set(
      t.subject,
      (planCountBySubject.get(t.subject) ?? 0) + 1,
    );
  }

  // Find each planned topic's set of "covering" rows in the window.
  const coveredTopicIds = new Set<string>();
  for (const r of input.rows ?? []) {
    if (!r || typeof r !== "object") continue;
    if (typeof r.topicId !== "string") continue;
    if (!Number.isFinite(r.loggedAtMs)) continue;
    if (r.loggedAtMs < windowStartMs || r.loggedAtMs > windowEndMs) continue;
    if (!isCoveringStatus(r.status)) continue;
    const minutes = Number.isFinite(r.minutes) ? (r.minutes as number) : 0;
    if (minutes <= 0) continue;
    if (!planByTopic.has(r.topicId)) continue; // unplanned rows ignored
    coveredTopicIds.add(r.topicId);
  }

  // Tally per subject.
  const coveredBySubject = new Map<CanonicalSubject, number>();
  for (const subj of CANONICAL_SUBJECTS) coveredBySubject.set(subj, 0);
  Array.from(coveredTopicIds).forEach((id) => {
    const subj = planByTopic.get(id)!;
    coveredBySubject.set(subj, (coveredBySubject.get(subj) ?? 0) + 1);
  });

  const perSubject: SubjectCoverage[] = CANONICAL_SUBJECTS.map((subj) => {
    const planned = planCountBySubject.get(subj) ?? 0;
    const covered = coveredBySubject.get(subj) ?? 0;
    const pct =
      planned > 0 ? Math.round((covered / planned) * 100) : 0;
    return {
      subject: subj,
      plannedCount: planned,
      coveredCount: covered,
      coveredPct: pct,
      band: bandFor(planned, pct),
    };
  });

  const totalPlanned = perSubject.reduce((a, s) => a + s.plannedCount, 0);
  const totalCovered = perSubject.reduce((a, s) => a + s.coveredCount, 0);
  const overallPct =
    totalPlanned > 0 ? Math.round((totalCovered / totalPlanned) * 100) : 0;
  const overallBand = bandFor(totalPlanned, overallPct);

  const zeroCoverageSubjects = perSubject
    .filter((s) => s.plannedCount > 0 && s.coveredCount === 0)
    .map((s) => s.subject);

  return {
    windowStartMs,
    windowEndMs,
    perSubject,
    overallPct,
    overallBand,
    zeroCoverageSubjects,
  };
}
