/**
 * Push 99 (2026-05-13) — Mood-log paper-trail PDF label generator.
 *
 * Mom's daily analytics CSV (see dailyAnalyticsCsv.ts) already powers
 * IEP paperwork. The new "behavior + mood timeline" PDF for IEP / 504
 * meetings + grandma sharing needs a single source of truth for:
 *   - human-readable zone label ("Green / Yellow / Red")
 *   - zone color (matches dashboard pills exactly)
 *   - 4-bucket day partition (morning / midday / afternoon / evening)
 *   - Grandma-share footer copy ("This is the same paper trail Mom
 *     uses for IEP meetings.")
 *
 * Pure module — deterministic, no DB.
 */

export type MoodZone = "green" | "yellow" | "red";

export interface MoodLogPdfRow {
  /** Local ISO timestamp. */
  loggedAt: string;
  zone: MoodZone;
  /** Optional adult note. */
  note?: string;
  /** Who logged it. */
  source: "kid-self" | "mom" | "grandma" | "tutor" | "ai";
}

export interface MoodLogPdfLabel {
  /** Display string used inline on the PDF, e.g. "Green · Calm". */
  badge: string;
  /** Hex matching dashboard. */
  hex: string;
  /** "morning" | "midday" | "afternoon" | "evening" — based on hour bucket. */
  dayBucket: "morning" | "midday" | "afternoon" | "evening";
  /** Short readable time, e.g. "9:14 AM". */
  timeLabel: string;
}

const ZONE_BADGE: Record<MoodZone, string> = {
  green: "Green · Calm",
  yellow: "Yellow · Watch",
  red: "Red · Crisis",
};

const ZONE_HEX: Record<MoodZone, string> = {
  green: "#10b981", // emerald-500
  yellow: "#f59e0b", // amber-500
  red: "#ef4444", // red-500
};

export function dayBucketFor(date: Date): MoodLogPdfLabel["dayBucket"] {
  const h = date.getHours();
  if (h < 11) return "morning";
  if (h < 14) return "midday";
  if (h < 18) return "afternoon";
  return "evening";
}

export function labelForMoodRow(row: MoodLogPdfRow): MoodLogPdfLabel {
  const d = new Date(row.loggedAt);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`labelForMoodRow: bad loggedAt "${row.loggedAt}"`);
  }
  const timeLabel = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    badge: ZONE_BADGE[row.zone],
    hex: ZONE_HEX[row.zone],
    dayBucket: dayBucketFor(d),
    timeLabel,
  };
}

/**
 * Shared share-footer for any PDF Grandma is allowed to forward.
 * Centralized so Mom can update wording once.
 */
export function grandmaShareFooter(opts: {
  /** Cover date label, e.g. "May 13, 2026". */
  dateLabel: string;
  /** Reagan's display name. */
  kidName?: string;
}): string {
  const kid = (opts.kidName ?? "Reagan").trim() || "Reagan";
  return [
    `${kid} · Behavior + Mood Timeline · ${opts.dateLabel}`,
    `This is the same paper trail Mom uses for IEP meetings. Please don't repost without asking.`,
  ].join("\n");
}

/**
 * Group a flat list of rows into the four day buckets in canonical order.
 * The PDF renderer iterates this output directly.
 */
export function bucketMoodRows(
  rows: MoodLogPdfRow[],
): Array<{ bucket: MoodLogPdfLabel["dayBucket"]; rows: MoodLogPdfRow[] }> {
  const buckets: Record<MoodLogPdfLabel["dayBucket"], MoodLogPdfRow[]> = {
    morning: [],
    midday: [],
    afternoon: [],
    evening: [],
  };
  for (const row of rows) {
    const d = new Date(row.loggedAt);
    if (Number.isNaN(d.getTime())) continue; // skip malformed timestamps
    buckets[dayBucketFor(d)].push(row);
  }
  return (
    ["morning", "midday", "afternoon", "evening"] as const
  ).map((b) => ({ bucket: b, rows: buckets[b] }));
}
