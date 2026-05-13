/**
 * Push 114 (2026-05-13) — Mood weekly-rollup percentages pure helper.
 *
 * Pure aggregator that turns per-entry mood logs into a weekly rollup
 * suitable for the Sunday digest body composer (Push 109) and for the
 * Grandma SMS digest helper (Push 112).
 *
 * Canonical zones (from Push 99 mood-log labels):
 *   green  → "Calm"   (#22c55e)
 *   yellow → "Watch"  (#eab308)
 *   red    → "Crisis" (#ef4444)
 *
 * Tone rule: NEVER frames Reagan as "bad" — headlines only describe
 * the *week*, not the kid. Same Mom-IEP / Grandma-share copy norms.
 *
 * Pure module — no DB, no I/O.
 */

export type MoodZone = "green" | "yellow" | "red";

export interface MoodEntry {
  zone: MoodZone | string; // tolerate stringly inputs from older logs
  /** ISO timestamp; only used for "covered days" derivation. */
  atIso?: string;
}

export interface MoodWeeklyRollup {
  totalEntries: number;
  green: number;
  yellow: number;
  red: number;
  /** 0..1 share of total. */
  greenShare: number;
  yellowShare: number;
  redShare: number;
  /** Distinct YYYY-MM-DD days that had at least one entry. */
  coveredDays: number;
  /** Mom/Grandma-friendly headline (week-framed, never kid-framed). */
  headline: string;
  /** True when totalEntries === 0. */
  isEmpty: boolean;
}

const VALID_ZONES = new Set<MoodZone>(["green", "yellow", "red"]);

function dayBucket(iso: string | undefined): string | null {
  if (!iso) return null;
  const slice = iso.slice(0, 10);
  // Minimal sanity: YYYY-MM-DD shape.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slice)) return null;
  return slice;
}

function pickHeadline(args: {
  total: number;
  greenShare: number;
  redShare: number;
  coveredDays: number;
}): string {
  if (args.total === 0) return "No mood entries logged this week";
  if (args.coveredDays <= 1) return "Light week — only one day logged";
  if (args.redShare >= 0.4) return "Tough week — extra support time";
  if (args.redShare >= 0.2) return "Bumpy week — a few crisis moments";
  if (args.greenShare >= 0.7) return "Strong week — calm overall";
  if (args.greenShare >= 0.5) return "Steady week — mostly calm";
  return "Mixed week — watch zones common";
}

export function rollupMoodWeek(
  entries: ReadonlyArray<MoodEntry>,
): MoodWeeklyRollup {
  let green = 0;
  let yellow = 0;
  let red = 0;
  const days = new Set<string>();

  if (Array.isArray(entries)) {
    for (const e of entries) {
      if (!e || typeof e !== "object") continue;
      const z = String((e as MoodEntry).zone ?? "").toLowerCase();
      if (!VALID_ZONES.has(z as MoodZone)) continue;
      if (z === "green") green++;
      else if (z === "yellow") yellow++;
      else if (z === "red") red++;
      const day = dayBucket((e as MoodEntry).atIso);
      if (day) days.add(day);
    }
  }

  const total = green + yellow + red;
  const greenShare = total > 0 ? green / total : 0;
  const yellowShare = total > 0 ? yellow / total : 0;
  const redShare = total > 0 ? red / total : 0;
  const coveredDays = days.size;

  return {
    totalEntries: total,
    green,
    yellow,
    red,
    greenShare,
    yellowShare,
    redShare,
    coveredDays,
    headline: pickHeadline({ total, greenShare, redShare, coveredDays }),
    isEmpty: total === 0,
  };
}
