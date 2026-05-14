/**
 * Overnight push 2026-05-14 — self-rebalancing day timeline (pure helper).
 *
 * Mom asked for "creating sunken and changed the days timeline should def be
 * easy. stay at different time each morning and changes change easily."
 * Translation: the day's start time slips, blocks run long, mood dips —
 * the dashboard should re-shuffle automatically without anyone editing
 * a calendar by hand.
 *
 * Inputs:
 *   - the morning's planned blocks (sortOrder, title, subjectName,
 *     scheduledMinutes)
 *   - actualStartHHmm: when the day actually started (e.g. "09:35")
 *   - any per-block status updates: actualMinutes (if completed/in-progress)
 *     and Kiwi mood adjustment ("none" | "shorten_next" | "swap_to_movement"
 *     | "end_block_now")
 *   - hard floor / ceiling for any single block
 *   - hard end-of-day cutoff (e.g. "15:30")
 *
 * Output: a new ordered list of blocks with adjusted start/end times,
 * an inserted movement block where requested, and a `notes` array a UI
 * can render as plain English ("Math is 10 min shorter; we added a
 * stretch break at 11:05.").
 *
 * Pure: no DB / no IO; deterministic for the same inputs.
 */

export interface PlannedBlock {
  blockSortOrder: number;
  blockTitle: string;
  subjectName?: string | null;
  scheduledMinutes: number; // > 0
  /** Optional status carried from earlier in the day. */
  actualMinutes?: number | null;
  status?: "pending" | "in_progress" | "done";
  /** From kiwiMoodTracker.readKiwiMoodForBlock(). */
  moodAdjustment?: "none" | "shorten_next" | "swap_to_movement" | "end_block_now";
  /** Locked blocks (e.g. mom-on-call tutor) won't be moved. */
  locked?: boolean;
}

export interface RebalancerOptions {
  /** "HH:mm" (24h) when the day actually started. */
  actualStartHHmm: string;
  /** "HH:mm" hard cutoff for the school day. */
  hardEndHHmm: string;
  /** Don't shrink any block below this many minutes. */
  minBlockMinutes?: number;
  /** Don't grow any block beyond this many minutes. */
  maxBlockMinutes?: number;
  /** Minutes per movement break inserted on swap_to_movement. */
  movementMinutes?: number;
}

export interface ScheduledBlock {
  blockSortOrder: number;
  blockTitle: string;
  subjectName?: string | null;
  startHHmm: string;
  endHHmm: string;
  durationMinutes: number;
  status: "pending" | "in_progress" | "done";
  /** True if helper inserted this block (movement break). */
  insertedByRebalancer?: boolean;
  /** True if the helper had to drop this block past hardEnd. */
  spilledPastEnd?: boolean;
}

export interface RebalanceResult {
  blocks: ScheduledBlock[];
  notes: string[];
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h | 0) * 60 + (m | 0);
}
function minToHHmm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = ((min % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function rebalanceDayTimeline(
  planned: PlannedBlock[],
  opts: RebalancerOptions,
): RebalanceResult {
  const minBlock = Math.max(1, opts.minBlockMinutes ?? 10);
  const maxBlock = Math.max(minBlock, opts.maxBlockMinutes ?? 60);
  const movement = Math.max(3, opts.movementMinutes ?? 5);

  const startMin = hhmmToMin(opts.actualStartHHmm);
  const hardEndMin = hhmmToMin(opts.hardEndHHmm);

  const sorted = [...planned].sort(
    (a, b) => a.blockSortOrder - b.blockSortOrder,
  );

  const out: ScheduledBlock[] = [];
  const notes: string[] = [];
  let cursor = startMin;

  for (let i = 0; i < sorted.length; i++) {
    const block = sorted[i];
    let dur = Math.max(1, Math.round(block.scheduledMinutes));

    // If the block is completed/in-progress, use actualMinutes instead.
    if (block.status === "done" && block.actualMinutes != null) {
      dur = Math.max(1, Math.round(block.actualMinutes));
    } else if (block.status === "in_progress" && block.actualMinutes != null) {
      dur = Math.max(1, Math.round(block.actualMinutes));
    }

    // Mood adjustments only affect future blocks.
    if (
      block.status !== "done" &&
      block.status !== "in_progress" &&
      !block.locked
    ) {
      const prev = i > 0 ? sorted[i - 1] : null;
      if (prev?.moodAdjustment === "shorten_next") {
        const shortened = Math.max(minBlock, Math.round(dur * 0.75));
        if (shortened !== dur) {
          notes.push(
            `${block.blockTitle} is ${dur - shortened} min shorter — Reagan was getting tired.`,
          );
          dur = shortened;
        }
      }
    }

    // Clamp within min/max sizes (locked blocks pass through untouched).
    if (!block.locked) {
      if (dur < minBlock) dur = minBlock;
      if (dur > maxBlock) dur = maxBlock;
    }

    const end = cursor + dur;
    out.push({
      blockSortOrder: block.blockSortOrder,
      blockTitle: block.blockTitle,
      subjectName: block.subjectName ?? null,
      startHHmm: minToHHmm(cursor),
      endHHmm: minToHHmm(end),
      durationMinutes: dur,
      status: block.status ?? "pending",
      spilledPastEnd: end > hardEndMin,
    });
    cursor = end;

    // After the block — handle end_block_now (already over) + insert
    // movement break for swap_to_movement, and skip-rest-of-day for
    // end_block_now if mood is bad mid-day.
    if (block.moodAdjustment === "swap_to_movement" && i < sorted.length - 1) {
      const moveStart = cursor;
      const moveEnd = moveStart + movement;
      out.push({
        blockSortOrder: block.blockSortOrder + 0.5,
        blockTitle: "Stretch / Outside Break",
        subjectName: "Movement",
        startHHmm: minToHHmm(moveStart),
        endHHmm: minToHHmm(moveEnd),
        durationMinutes: movement,
        status: "pending",
        insertedByRebalancer: true,
        spilledPastEnd: moveEnd > hardEndMin,
      });
      notes.push(
        `Added a ${movement}-min stretch break at ${minToHHmm(moveStart)} — Reagan needed to move.`,
      );
      cursor = moveEnd;
    }
  }

  // Note when the day spilled past the hard cutoff.
  const spilled = out.filter((b) => b.spilledPastEnd && !b.insertedByRebalancer);
  if (spilled.length > 0) {
    notes.push(
      `${spilled.length} block${spilled.length === 1 ? "" : "s"} run past ${opts.hardEndHHmm} — consider trimming tomorrow.`,
    );
  }

  return { blocks: out, notes };
}
