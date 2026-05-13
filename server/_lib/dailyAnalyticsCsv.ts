/**
 * Daily Analytics CSV builder — push 34 (2026-05-13).
 *
 * Mom-only daily paper trail for IEP meetings + grandma sharing. Aggregates
 * everything an IEP team would want to see for one day onto ONE CSV row +
 * one focus-detail row per recorded subject. The file is stable-schema so
 * Mom can stack 60 days into a spreadsheet without column drift.
 *
 * Pure-function design: takes a `DailyAnalyticsInputs` payload and returns
 * the CSV string. DB reads + Drive enqueue happen in the orchestrator
 * (`db.buildDailyAnalyticsCsv`) so this module stays trivially unit-testable.
 *
 * Spec items closed:
 *   - "Mom-only nightly Drive analytics CSV export — daily paper trail
 *      for IEP meetings"
 *   - "Analytics CSV column structure locked by vitest"
 */

export interface DailyAnalyticsInputs {
  dateISO: string; // YYYY-MM-DD
  // Listening behavior (Mom-only adult signal, school-window gated).
  listening: {
    relevantCount: number;
    droppedCount: number;
    focusPct: number; // 0..100
    offTask: number;
    distractions: number;
    topTopic: string | null;
    avgEmotion: number | null;      // -100..100
    avgComfort: number | null;      // 0..100
    avgDifficulty: number | null;   // 0..100
    avgTalkativeness: number | null; // 0..100
    minutesOnTask: number;
  } | null;
  // Kiwi-chat behavior (adult only).
  kiwi: {
    interactions: number;
    userMessages: number;
    aiMessages: number;
    kiwiInitiatedCount: number;
    topTopic: string | null;
    topTopicCount: number;
  } | null;
  // Coverage (planned vs completed).
  coverage: Array<{
    subjectSlug: string;
    total: number;
    done: number;
    pct: number;
  }>;
  // Block completion counts.
  blocks: {
    plannedTotal: number;
    completedTotal: number;
    skippedTotal: number;
  };
  // IEP-goal status snapshot (Behind / On / Ahead chip counts).
  iep: {
    behind: number;
    onTrack: number;
    ahead: number;
  };
  // Off-plan topics surfaced this day.
  offPlanTopicsCount: number;
}

/**
 * Escape a field for CSV per RFC 4180.
 * - Wraps in quotes if it contains comma, quote, CR, or LF.
 * - Doubles internal quotes.
 * - null / undefined → empty string.
 */
export function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.length === 0) return "";
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Stable column header set. NEVER reorder or rename without bumping the
 * schema version (would break Mom's existing rolling spreadsheet).
 */
export const DAILY_ANALYTICS_COLUMNS = [
  "date",
  "blocks_planned",
  "blocks_completed",
  "blocks_skipped",
  "coverage_subjects",
  "coverage_avg_pct",
  "listening_focus_pct",
  "listening_relevant_chunks",
  "listening_dropped_chunks",
  "listening_off_task",
  "listening_distractions",
  "listening_minutes_on_task",
  "listening_top_topic",
  "avg_emotion",
  "avg_comfort",
  "avg_difficulty",
  "avg_talkativeness",
  "kiwi_interactions",
  "kiwi_user_messages",
  "kiwi_initiated_checkins",
  "kiwi_top_topic",
  "iep_behind",
  "iep_on_track",
  "iep_ahead",
  "off_plan_topics_count",
] as const;

export type DailyAnalyticsColumn = (typeof DAILY_ANALYTICS_COLUMNS)[number];

/**
 * Build the one-row daily CSV (header row + single data row).
 * Headers always present. Numeric nulls render as empty.
 */
export function buildDailyAnalyticsCsv(inputs: DailyAnalyticsInputs): string {
  const cov = inputs.coverage;
  const coverageAvg =
    cov.length === 0
      ? null
      : Math.round(cov.reduce((acc, r) => acc + (r.pct || 0), 0) / cov.length);

  const row: Record<DailyAnalyticsColumn, string | number | null> = {
    date: inputs.dateISO,
    blocks_planned: inputs.blocks.plannedTotal,
    blocks_completed: inputs.blocks.completedTotal,
    blocks_skipped: inputs.blocks.skippedTotal,
    coverage_subjects: cov.length,
    coverage_avg_pct: coverageAvg,
    listening_focus_pct: inputs.listening?.focusPct ?? null,
    listening_relevant_chunks: inputs.listening?.relevantCount ?? null,
    listening_dropped_chunks: inputs.listening?.droppedCount ?? null,
    listening_off_task: inputs.listening?.offTask ?? null,
    listening_distractions: inputs.listening?.distractions ?? null,
    listening_minutes_on_task: inputs.listening?.minutesOnTask ?? null,
    listening_top_topic: inputs.listening?.topTopic ?? null,
    avg_emotion: inputs.listening?.avgEmotion ?? null,
    avg_comfort: inputs.listening?.avgComfort ?? null,
    avg_difficulty: inputs.listening?.avgDifficulty ?? null,
    avg_talkativeness: inputs.listening?.avgTalkativeness ?? null,
    kiwi_interactions: inputs.kiwi?.interactions ?? null,
    kiwi_user_messages: inputs.kiwi?.userMessages ?? null,
    kiwi_initiated_checkins: inputs.kiwi?.kiwiInitiatedCount ?? null,
    kiwi_top_topic: inputs.kiwi?.topTopic ?? null,
    iep_behind: inputs.iep.behind,
    iep_on_track: inputs.iep.onTrack,
    iep_ahead: inputs.iep.ahead,
    off_plan_topics_count: inputs.offPlanTopicsCount,
  };

  const header = DAILY_ANALYTICS_COLUMNS.join(",");
  const data = DAILY_ANALYTICS_COLUMNS.map((c) => csvEscape(row[c])).join(",");
  return header + "\r\n" + data + "\r\n";
}

/**
 * Canonical filename for the Mom-only daily analytics CSV file.
 *  → "2026-05-13 - Daily Analytics.csv"
 */
export function dailyAnalyticsFileName(dateISO: string): string {
  return `${dateISO} - Daily Analytics.csv`;
}

/**
 * Canonical Drive subpath = YYYY-MM month folder under
 * "Progress and Reports / Analytics CSV Exports".
 */
export function dailyAnalyticsSubpath(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/**
 * Bucket helper for the Behind/On/Ahead chip counts. Mirrors the same
 * logic the Analytics page uses for the IEP at-a-glance card (push 21):
 *   raw=='met' || raw=='ahead' || pct>=1.0 → ahead
 *   raw=='not_met' || raw=='at_risk' || raw=='behind' || pct<0.5 → behind
 *   else → on
 */
export function bucketIepGoal(g: {
  status?: string | null;
  currentPercent?: number | null;
  targetPercent?: number | null;
}): "behind" | "onTrack" | "ahead" {
  const raw = String(g.status || "in_progress").toLowerCase();
  const pct =
    typeof g.currentPercent === "number" &&
    typeof g.targetPercent === "number" &&
    g.targetPercent > 0
      ? g.currentPercent / g.targetPercent
      : null;
  if (raw === "met" || raw === "ahead" || (pct !== null && pct >= 1)) {
    return "ahead";
  }
  if (
    raw === "not_met" ||
    raw === "at_risk" ||
    raw === "behind" ||
    (pct !== null && pct < 0.5)
  ) {
    return "behind";
  }
  return "onTrack";
}
