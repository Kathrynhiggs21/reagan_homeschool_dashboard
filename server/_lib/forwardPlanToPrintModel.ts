/**
 * forwardPlanToPrintModel — Push 2.12 (2026-05-17)
 *
 * Pure function. Folds a flat list of forward-planner rows (the same shape
 * `planForward()` emits + topic+book metadata the router can hydrate) into a
 * printable per-day model:
 *
 *   {
 *     title: "Reagan's plan — Sep 13 → Sep 24, 2027",
 *     dateRange: { from, to },
 *     totals: { topics, blockerTopics },
 *     days: [
 *       { date, weekday, label, slots: [{ slotIndex, subject, code, title, evidence, isBlockerFrontload }] },
 *       ...
 *     ]
 *   }
 *
 * Output is sorted by (date ASC, slotIndex ASC). Empty days (e.g. a Sat
 * dropped in by accident) are filtered out. The helper is DOM-free and
 * timezone-stable (treats yyyy-mm-dd as a UTC date, never local).
 */

import type { PlanRow } from "./curriculumForwardPlanner";

export type PrintDay = {
  date: string;
  weekday: number;
  label: string; // "Mon, Sep 13"
  slots: PlanRow[]; // already sorted by slotIndex
};

export type PrintModel = {
  title: string;
  dateRange: { from: string; to: string } | null;
  totals: { topics: number; blockerTopics: number };
  days: PrintDay[];
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function shortLabel(iso: string): string {
  const d = parseIso(iso);
  return `${DOW[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
function longLabel(iso: string): string {
  const d = parseIso(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function forwardPlanToPrintModel(
  rows: PlanRow[],
  opts?: { title?: string; subtitle?: string },
): PrintModel {
  if (rows.length === 0) {
    return {
      title: opts?.title ?? "Reagan's plan",
      dateRange: null,
      totals: { topics: 0, blockerTopics: 0 },
      days: [],
    };
  }

  // Group by date.
  const byDate = new Map<string, PlanRow[]>();
  for (const r of rows) {
    const arr = byDate.get(r.date) || [];
    arr.push(r);
    byDate.set(r.date, arr);
  }
  const dates = Array.from(byDate.keys()).sort();
  const days: PrintDay[] = dates.map((date) => {
    const slots = (byDate.get(date) || []).slice().sort((a, b) => a.slotIndex - b.slotIndex);
    return {
      date,
      weekday: parseIso(date).getUTCDay(),
      label: shortLabel(date),
      slots,
    };
  });

  const blockerTopics = rows.filter((r) => r.isBlockerFrontload).length;
  const from = dates[0];
  const to = dates[dates.length - 1];
  const titleBase = opts?.title ?? "Reagan's plan";
  const title =
    from === to
      ? `${titleBase} — ${longLabel(from)}`
      : `${titleBase} — ${longLabel(from)} \u2192 ${longLabel(to)}`;

  return {
    title,
    dateRange: { from, to },
    totals: { topics: rows.length, blockerTopics },
    days,
  };
}
