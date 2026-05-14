/**
 * Push 150 (2026-05-14) — Mood-triggered timeline-shift bridge (pure).
 *
 * The two pieces are already independent:
 *   - kiwiMoodTracker.readKiwiMoodForBlock(...) -> { suggestedAdjustment, ... }
 *   - dayTimelineRebalancer.rebalanceDayTimeline(blocks, opts) -> shifted plan
 *     (each block accepts a per-block `moodAdjustment` input)
 *
 * This bridge maps the live mood reading for the *currently active* block
 * back onto the rebalancer's per-block `moodAdjustment` field, so the
 * server can route Kiwi's signal into the auto-rebalance call without
 * either side having to know about the other.
 *
 * Pure: no DB / no IO / deterministic.
 *
 * Conservative-by-default: if the active block isn't found by sortOrder,
 * or the mood is "great"/"okay" (i.e. the helper said `none`), we leave
 * the input list completely unchanged.
 */

export interface RebalancerBlockInput {
  blockSortOrder: number;
  blockTitle: string;
  subjectName?: string | null;
  scheduledMinutes: number;
  actualMinutes?: number | null;
  status?: "pending" | "in_progress" | "done";
  moodAdjustment?: "none" | "shorten_next" | "swap_to_movement" | "end_block_now";
  locked?: boolean;
}

export interface MoodReadingLike {
  /** Match readKiwiMoodForBlock output. */
  suggestedAdjustment:
    | "none"
    | "shorten_next"
    | "swap_to_movement"
    | "end_block_now";
}

export interface ApplyMoodOptions {
  /** sortOrder of the block Kiwi just observed. */
  activeBlockSortOrder: number;
  /** If a previous bridge run already set an adjustment on the active
   *  block, should the new mood reading override it? Defaults to true
   *  ("the latest mood always wins"). Set false to keep tutor-set
   *  adjustments sticky. */
  overrideExisting?: boolean;
}

export interface ApplyMoodResult {
  /** New block list with the active block's moodAdjustment updated. */
  blocks: RebalancerBlockInput[];
  /** True if any block was modified. */
  changed: boolean;
  /** Plain-English single sentence Mom + Grandma can read in the day-log. */
  reason: string;
}

const ADJUSTMENT_REASON: Record<
  MoodReadingLike["suggestedAdjustment"],
  string
> = {
  none: "Reagan is doing fine, no schedule change needed.",
  shorten_next:
    "Reagan is dragging — Kiwi shortened the next block to keep her going.",
  swap_to_movement:
    "Reagan needs to move — Kiwi added a quick stretch break next.",
  end_block_now:
    "Reagan is too frustrated — Kiwi is wrapping this block early.",
};

export function applyMoodToTimelineBlocks(
  blocks: RebalancerBlockInput[],
  reading: MoodReadingLike,
  opts: ApplyMoodOptions,
): ApplyMoodResult {
  const adjustment = reading.suggestedAdjustment;

  // Mood says "no change needed" — pass-through, no clones.
  if (adjustment === "none") {
    return {
      blocks,
      changed: false,
      reason: ADJUSTMENT_REASON.none,
    };
  }

  const idx = blocks.findIndex(
    (b) => b.blockSortOrder === opts.activeBlockSortOrder,
  );
  if (idx === -1) {
    return {
      blocks,
      changed: false,
      reason:
        "Kiwi noticed something but couldn't match it to a block — left the schedule alone.",
    };
  }

  const active = blocks[idx];

  // Locked block — never override.
  if (active.locked) {
    return {
      blocks,
      changed: false,
      reason:
        "Mom locked this block, so Kiwi will leave the schedule alone.",
    };
  }

  // Existing adjustment + override disabled — keep tutor-set value.
  const overrideExisting = opts.overrideExisting ?? true;
  if (
    !overrideExisting &&
    active.moodAdjustment &&
    active.moodAdjustment !== "none"
  ) {
    return {
      blocks,
      changed: false,
      reason: ADJUSTMENT_REASON[active.moodAdjustment],
    };
  }

  // No-op if the existing adjustment already matches.
  if (active.moodAdjustment === adjustment) {
    return {
      blocks,
      changed: false,
      reason: ADJUSTMENT_REASON[adjustment],
    };
  }

  const next = blocks.slice();
  next[idx] = { ...active, moodAdjustment: adjustment };
  return {
    blocks: next,
    changed: true,
    reason: ADJUSTMENT_REASON[adjustment],
  };
}
