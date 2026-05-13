/**
 * Push 103 (2026-05-13) — TapEditPopover start-time + duration validator.
 *
 * Mom / Grandma / tutors can tap a block on Today or Schedule to nudge
 * start time and duration WITHOUT opening the AI Agenda Editor. This
 * popover sends the proposed values to a server-side mutation; the
 * mutation in turn calls this validator before writing.
 *
 * Rules:
 *   - Start time must be HH:MM in 24h, between 06:00 and 22:00.
 *   - Duration: integer minutes, between 5 and 240 (4h cap to prevent
 *     accidental day-eating edits).
 *   - End time (start + duration) must not pass 22:30 (Reagan needs
 *     wind-down time).
 *   - No collision with other locked blocks (e.g., tutor sessions).
 *
 * Pure module — deterministic, no DB.
 */

export type TimeValidationError =
  | "bad-start-format"
  | "start-out-of-window"
  | "bad-duration"
  | "duration-out-of-range"
  | "end-past-wind-down"
  | "collides-with-locked-block";

export interface TapEditInput {
  startTime: string; // "HH:MM" 24h
  durationMinutes: number;
  /** Other blocks that this edit must not collide with (e.g., tutor). */
  lockedBlocks?: Array<{ startMinutes: number; durationMinutes: number; label?: string }>;
  /** The id of the block being edited (omit it from collision check). */
  selfStartMinutes?: number;
}

export interface TapEditValid {
  ok: true;
  startMinutes: number; // minutes since midnight
  endMinutes: number;
}

export interface TapEditInvalid {
  ok: false;
  error: TimeValidationError;
  message: string;
  /** When the error is a collision, expose the colliding block label. */
  collidesWith?: string;
}

export type TapEditResult = TapEditValid | TapEditInvalid;

const WINDOW_START = 6 * 60; // 06:00
const WINDOW_END = 22 * 60; // 22:00
const WIND_DOWN = 22 * 60 + 30; // 22:30

function parseHHMM(s: string): number | null {
  if (typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function validateTapEdit(input: TapEditInput): TapEditResult {
  const startMinutes = parseHHMM(input.startTime);
  if (startMinutes === null) {
    return {
      ok: false,
      error: "bad-start-format",
      message: "Start time must look like 09:15.",
    };
  }
  if (startMinutes < WINDOW_START || startMinutes > WINDOW_END) {
    return {
      ok: false,
      error: "start-out-of-window",
      message: "Start time must be between 06:00 and 22:00.",
    };
  }

  if (
    typeof input.durationMinutes !== "number" ||
    !Number.isFinite(input.durationMinutes) ||
    Math.floor(input.durationMinutes) !== input.durationMinutes
  ) {
    return {
      ok: false,
      error: "bad-duration",
      message: "Duration must be a whole number of minutes.",
    };
  }
  if (input.durationMinutes < 5 || input.durationMinutes > 240) {
    return {
      ok: false,
      error: "duration-out-of-range",
      message: "Duration must be between 5 and 240 minutes.",
    };
  }

  const endMinutes = startMinutes + input.durationMinutes;
  if (endMinutes > WIND_DOWN) {
    return {
      ok: false,
      error: "end-past-wind-down",
      message: "Block ends after Reagan's 10:30 PM wind-down. Shorten it or move it earlier.",
    };
  }

  // Collision check against locked blocks (tutor sessions etc.)
  for (const blk of input.lockedBlocks ?? []) {
    // Skip "self" — when the user just nudges the same block in place.
    if (
      typeof input.selfStartMinutes === "number" &&
      blk.startMinutes === input.selfStartMinutes
    ) {
      continue;
    }
    const blkEnd = blk.startMinutes + blk.durationMinutes;
    // Overlap if intervals [start, end) intersect.
    const overlaps =
      startMinutes < blkEnd && endMinutes > blk.startMinutes;
    if (overlaps) {
      return {
        ok: false,
        error: "collides-with-locked-block",
        message: `This time overlaps with ${blk.label ?? "another locked block"}.`,
        collidesWith: blk.label,
      };
    }
  }

  return { ok: true, startMinutes, endMinutes };
}
