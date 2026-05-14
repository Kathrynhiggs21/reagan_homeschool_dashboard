/**
 * Push 153 (2026-05-14) — Analytics strip empty-state guard (pure helper).
 *
 * Mom: "the analytics strip shows grey boxes when there's no data — fix
 * it so it just hides instead of showing 0 / 0 / 0." This pure helper
 * decides per-tile (and for the strip overall) whether to render or hide.
 *
 * Rule: a tile is shown ONLY if its underlying signal has a positive,
 * real measurement. Synthetic zeros (e.g. "no submissions yet today")
 * count as empty. Caller passes the raw aggregate; helper returns the
 * filtered tile list + a stripVisible flag.
 *
 * Pure: no DB / no IO / deterministic.
 */

export type AnalyticsTileKey =
  | "blocks_done"
  | "minutes_on_task"
  | "submissions_graded"
  | "current_streak_days"
  | "subjects_touched";

export interface AnalyticsRawAggregate {
  blocksDone: number;
  blocksPlanned: number;
  minutesOnTask: number;
  submissionsGraded: number;
  currentStreakDays: number;
  subjectsTouched: number;
}

export interface AnalyticsTile {
  key: AnalyticsTileKey;
  /** Big number Mom + Grandma see in the tile. */
  value: number;
  /** Plain-English label under the number. */
  label: string;
  /** Plain-English headline above the number ("Today" / "This week"). */
  scope: string;
}

export interface AnalyticsStripGuardResult {
  /** True when the strip should render. */
  stripVisible: boolean;
  /** Tiles that passed the empty-state guard, in display order. */
  tiles: AnalyticsTile[];
  /** Plain-English single sentence to show Mom WHEN the strip is hidden. */
  emptyStateMessage: string | null;
}

export function guardAnalyticsStrip(
  raw: AnalyticsRawAggregate,
): AnalyticsStripGuardResult {
  const tiles: AnalyticsTile[] = [];

  if (raw.blocksDone > 0 || raw.blocksPlanned > 0) {
    tiles.push({
      key: "blocks_done",
      value: raw.blocksDone,
      label: raw.blocksPlanned > 0
        ? `of ${raw.blocksPlanned} blocks done`
        : "blocks done",
      scope: "Today",
    });
  }
  if (raw.minutesOnTask > 0) {
    tiles.push({
      key: "minutes_on_task",
      value: raw.minutesOnTask,
      label: "minutes working",
      scope: "Today",
    });
  }
  if (raw.submissionsGraded > 0) {
    tiles.push({
      key: "submissions_graded",
      value: raw.submissionsGraded,
      label: "items graded",
      scope: "Today",
    });
  }
  if (raw.subjectsTouched > 0) {
    tiles.push({
      key: "subjects_touched",
      value: raw.subjectsTouched,
      label: "subjects touched",
      scope: "Today",
    });
  }
  if (raw.currentStreakDays > 0) {
    tiles.push({
      key: "current_streak_days",
      value: raw.currentStreakDays,
      label: raw.currentStreakDays === 1 ? "day in a row" : "days in a row",
      scope: "Streak",
    });
  }

  if (tiles.length === 0) {
    return {
      stripVisible: false,
      tiles: [],
      emptyStateMessage:
        "No school activity yet today — the analytics strip will appear after the first block.",
    };
  }
  return { stripVisible: true, tiles, emptyStateMessage: null };
}
