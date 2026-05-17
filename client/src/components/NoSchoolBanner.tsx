/**
 * NoSchoolBanner — v2.23 (2026-05-17)
 *
 * Small kid-friendly banner that appears on Today.tsx when today is an
 * Indian Hill (or otherwise calendar-flagged) off-day. Reads from the
 * existing `schoolCalendar.list` query (already cached by the Schedule
 * page) and looks up today by ISO date string.
 *
 * Design intent:
 *   - Reagan should immediately understand "today is a no-school day,
 *     not just an empty schedule."
 *   - Soft / cozy phrasing per the no-pressure design language
 *     (no "DAY OFF" all-caps, no exclamation marks).
 *   - Uses a leaf emoji as a visual cue without leaning on emoji as the
 *     only signal.
 *   - Hides itself entirely when there is nothing to say (no flicker,
 *     no placeholder per the "don't show if no info" house rule).
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

interface NoSchoolBannerProps {
  /** ISO date string (YYYY-MM-DD). Defaults to local-today if omitted. */
  dateStr?: string;
  /** Optional className passthrough so callers control spacing. */
  className?: string;
}

function todayIso(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function NoSchoolBanner({ dateStr, className }: NoSchoolBannerProps) {
  const date = dateStr ?? todayIso();
  // Re-uses the same cached query the Schedule page primes — usually a
  // free read because the user has already opened Schedule earlier.
  const calendarQ = trpc.schoolCalendar.list.useQuery();

  const offRow = useMemo(() => {
    // Drizzle returns `date` as a Date object in some shapes and ISO string
    // in others. Normalize both sides via slice(0,10) so the lookup works
    // regardless. (Schedule.tsx uses `as any[]` for the same reason.)
    const rows = (calendarQ.data || []) as any[];
    return rows.find((r) => {
      const rIso = String(r.date instanceof Date ? r.date.toISOString() : r.date).slice(0, 10);
      return rIso === date && (r.isOff === true || r.isOff === 1);
    });
  }, [calendarQ.data, date]);

  // House rule: don't show if no info. Hide while loading too — we'd
  // rather not flicker the banner in and out of existence.
  if (!offRow) return null;

  return (
    <div
      data-testid="no-school-banner"
      className={
        "rounded-2xl border border-amber-200 bg-amber-50/90 text-amber-900 " +
        "px-4 py-3 flex items-center gap-3 shadow-sm " +
        (className ?? "")
      }
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" className="text-xl leading-none">
        🍂
      </span>
      <div className="flex flex-col">
        <div className="font-display font-semibold leading-tight">
          {offRow.label || "No school today"}
        </div>
        <div className="text-sm opacity-80">
          No school today — go play, rest, or invent something cozy.
        </div>
      </div>
    </div>
  );
}

export default NoSchoolBanner;
