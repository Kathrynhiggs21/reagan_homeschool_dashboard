/**
 * Push 90 (2026-05-13) — Mood timeline strip on Today.
 *
 * Renders one zone-colored cell per hour of Reagan's "school day" window
 * (default 08:00 → 16:00 local, configurable via prefs). Each cell is
 * driven by the most-recent moodLogs entry that falls inside that hour
 * (if any). Hours with no log render as a soft gray "no entry" cell.
 *
 * Pure module: takes mood rows + window options, returns the strip rows.
 * The DB query lives in routers.ts; this file is the deterministic shape
 * the contract locks.
 *
 * Self-hide rule:
 *   - buildMoodTimelineStrip() always returns a `cells` array of the
 *     expected length (window hours). The caller (component) self-hides
 *     when `cells.every(c => c.zone === null)` — i.e. no mood entries
 *     today at all. The strip never invents data.
 */

export type MoodZone = "green" | "yellow" | "red";

export type MoodLogInput = {
  /** ms since epoch */
  loggedAtMs: number;
  zone: MoodZone;
  note?: string | null;
};

export type MoodTimelineCell = {
  /** local hour 0..23 the cell covers */
  hour: number;
  /** display label "8a", "1p", "12p" */
  hourLabel: string;
  /** color zone, or null if no entry in this hour */
  zone: MoodZone | null;
  /** color hex resolved from zone (or neutral for null) */
  color: string;
  /** optional tooltip (note from the entry) */
  note: string | null;
};

export type MoodTimelineStrip = {
  cells: MoodTimelineCell[];
  hasAny: boolean;
};

export type MoodTimelineOptions = {
  /** local-time start hour, inclusive (default 8) */
  startHour?: number;
  /** local-time end hour, exclusive (default 16) */
  endHour?: number;
  /** "today" in local time, YYYY-MM-DD; used to bound the window */
  localDateIso: string;
  /** offset applied to convert UTC ms to local clock; in minutes from UTC
   *  (e.g. EDT = -240). Caller computes this once on the server. */
  tzOffsetMin: number;
};

const ZONE_COLORS: Record<MoodZone, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};
const NEUTRAL_COLOR = "#3f3a30"; // warm slate "no entry"

export function zoneToColor(zone: MoodZone | null): string {
  if (!zone) return NEUTRAL_COLOR;
  return ZONE_COLORS[zone];
}

function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}

/**
 * Convert a UTC ms timestamp into a local-clock `{ dateIso, hour }`
 * pair using a fixed tzOffsetMin (minutes from UTC, e.g. EDT = -240).
 * Pure and deterministic.
 */
function utcMsToLocal(ms: number, tzOffsetMin: number): { dateIso: string; hour: number } {
  // tzOffsetMin is "minutes from UTC", e.g. EDT = -240 → local = utc + (-240) min
  const local = new Date(ms + tzOffsetMin * 60_000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return { dateIso: `${y}-${m}-${d}`, hour: local.getUTCHours() };
}

export function buildMoodTimelineStrip(
  rows: MoodLogInput[],
  opts: MoodTimelineOptions,
): MoodTimelineStrip {
  const startHour = clampHour(opts.startHour ?? 8);
  let endHour = clampHour(opts.endHour ?? 16);
  if (endHour <= startHour) endHour = Math.min(24, startHour + 1);

  // Bucket by local hour, keeping the latest log per hour.
  const byHour = new Map<number, MoodLogInput>();
  for (const row of rows) {
    const local = utcMsToLocal(row.loggedAtMs, opts.tzOffsetMin);
    if (local.dateIso !== opts.localDateIso) continue;
    if (local.hour < startHour || local.hour >= endHour) continue;
    const prev = byHour.get(local.hour);
    if (!prev || prev.loggedAtMs < row.loggedAtMs) byHour.set(local.hour, row);
  }

  const cells: MoodTimelineCell[] = [];
  for (let h = startHour; h < endHour; h++) {
    const row = byHour.get(h);
    cells.push({
      hour: h,
      hourLabel: hourLabel(h),
      zone: row?.zone ?? null,
      color: zoneToColor(row?.zone ?? null),
      note: row?.note ?? null,
    });
  }

  return {
    cells,
    hasAny: cells.some(c => c.zone !== null),
  };
}

function clampHour(h: number): number {
  if (!Number.isFinite(h)) return 8;
  return Math.max(0, Math.min(24, Math.floor(h)));
}
