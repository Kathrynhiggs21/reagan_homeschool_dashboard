/**
 * curriculumForwardPlanner — Push 2.10 (2026-05-17)
 *
 * Pure function. Given the curriculum gap (per-subject lists of unfinished
 * topics) plus the family's weekly subject shape and a horizon in school
 * days, emits a deterministic per-day plan: which topic to slot into which
 * subject block on which date.
 *
 * Inputs:
 *   - gap: { [subject]: { inProgress: Topic[], notStarted: Topic[] } }
 *   - weeklyShape: { [weekday]: subject[] } where weekday in 0..6 (Sun=0),
 *     each entry is the ordered list of subjects that day.
 *   - horizonDays: number of *school* days to plan (default 10).
 *   - startDate: ISO yyyy-mm-dd; planner skips weekends from this date.
 *   - transcriptBlockers (optional): topic ids that must land in the
 *     first 3 school days regardless of normal subject ordering.
 *   - excludeWeekends: default true.
 *
 * Output rows are sorted by (date ASC, slotIndex ASC) so the result is
 * deterministic and friendly for downstream tests + UI rendering.
 */

export type GapTopic = {
  id: number;
  subject: string;
  code: string;
  title: string;
  status: "inProgress" | "notStarted";
  notes?: string | null;
  ord?: number | null;
};

export type GapBySubject = Record<
  string,
  { inProgress: GapTopic[]; notStarted: GapTopic[] }
>;

export type WeeklyShape = Record<number, string[]>;

export type PlanRow = {
  date: string; // yyyy-mm-dd
  weekday: number; // 0..6
  slotIndex: number; // 0-based slot within the day
  subject: string;
  topicId: number;
  code: string;
  title: string;
  evidence: string | null; // copy of `notes` if present
  isBlockerFrontload: boolean;
};

function pad2(n: number) {
  return n < 10 ? "0" + n : "" + n;
}
function toIso(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/**
 * Pop the next-best topic for a subject. Prefers `inProgress` (lowest ord),
 * falls back to `notStarted` (lowest ord). Mutates the gap to consume.
 */
function popNextForSubject(
  gap: GapBySubject,
  subject: string,
): GapTopic | null {
  const b = gap[subject];
  if (!b) return null;
  if (b.inProgress.length > 0) return b.inProgress.shift()!;
  if (b.notStarted.length > 0) return b.notStarted.shift()!;
  return null;
}

/**
 * Pop a specific topic id from any bucket of any subject. Used for
 * transcript-blocker front-loading. Returns the topic or null.
 */
function popTopicById(gap: GapBySubject, topicId: number): GapTopic | null {
  for (const subj of Object.keys(gap)) {
    const b = gap[subj];
    for (const list of [b.inProgress, b.notStarted]) {
      const idx = list.findIndex((t) => t.id === topicId);
      if (idx !== -1) {
        const [hit] = list.splice(idx, 1);
        return hit;
      }
    }
  }
  return null;
}

export function planForward(input: {
  gap: GapBySubject;
  weeklyShape: WeeklyShape;
  horizonDays?: number;
  startDate: string;
  transcriptBlockerTopicIds?: number[];
  excludeWeekends?: boolean;
}): PlanRow[] {
  const horizonDays = Math.max(1, Math.min(input.horizonDays ?? 10, 60));
  const excludeWeekends = input.excludeWeekends ?? true;
  // Deep-clone the gap so this remains a pure function.
  const gap: GapBySubject = {};
  for (const [subj, b] of Object.entries(input.gap)) {
    gap[subj] = {
      inProgress: [...b.inProgress],
      notStarted: [...b.notStarted],
    };
  }

  // Walk forward day-by-day until we have `horizonDays` school days.
  const schoolDays: { date: string; weekday: number }[] = [];
  let cursor = parseIso(input.startDate);
  let safety = 0;
  while (schoolDays.length < horizonDays && safety < 120) {
    const wd = cursor.getUTCDay();
    const isWeekend = wd === 0 || wd === 6;
    const allow = !excludeWeekends || !isWeekend;
    if (allow && (input.weeklyShape[wd]?.length ?? 0) > 0) {
      schoolDays.push({ date: toIso(cursor), weekday: wd });
    }
    cursor = addDays(cursor, 1);
    safety++;
  }

  const out: PlanRow[] = [];

  // Pass 1: front-load transcript blockers into the first 3 school days.
  const blockerIds = [...(input.transcriptBlockerTopicIds ?? [])];
  const frontloadDays = schoolDays.slice(0, Math.min(3, schoolDays.length));
  for (const day of frontloadDays) {
    if (blockerIds.length === 0) break;
    const subjectsThatDay = input.weeklyShape[day.weekday] ?? [];
    for (let slotIndex = 0; slotIndex < subjectsThatDay.length; slotIndex++) {
      if (blockerIds.length === 0) break;
      const subj = subjectsThatDay[slotIndex];
      // Find a blocker that belongs to this subject (if any), else any blocker.
      let chosenIdx = blockerIds.findIndex((id) => {
        const b = gap[subj];
        if (!b) return false;
        return (
          b.inProgress.some((t) => t.id === id) ||
          b.notStarted.some((t) => t.id === id)
        );
      });
      if (chosenIdx === -1) chosenIdx = 0;
      const blockerId = blockerIds.splice(chosenIdx, 1)[0];
      const t = popTopicById(gap, blockerId);
      if (!t) continue;
      out.push({
        date: day.date,
        weekday: day.weekday,
        slotIndex,
        subject: t.subject,
        topicId: t.id,
        code: t.code,
        title: t.title,
        evidence: t.notes ?? null,
        isBlockerFrontload: true,
      });
    }
  }

  // Pass 2: fill remaining slots from the gap.
  for (const day of schoolDays) {
    const subjectsThatDay = input.weeklyShape[day.weekday] ?? [];
    for (let slotIndex = 0; slotIndex < subjectsThatDay.length; slotIndex++) {
      const alreadyFilled = out.some(
        (r) => r.date === day.date && r.slotIndex === slotIndex,
      );
      if (alreadyFilled) continue;
      const subj = subjectsThatDay[slotIndex];
      const t = popNextForSubject(gap, subj);
      if (!t) continue;
      out.push({
        date: day.date,
        weekday: day.weekday,
        slotIndex,
        subject: subj,
        topicId: t.id,
        code: t.code,
        title: t.title,
        evidence: t.notes ?? null,
        isBlockerFrontload: false,
      });
    }
  }

  // Deterministic ordering for caller + tests.
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.slotIndex - b.slotIndex;
  });

  return out;
}
