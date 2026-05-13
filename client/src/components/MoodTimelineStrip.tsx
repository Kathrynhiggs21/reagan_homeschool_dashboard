/**
 * Push 90 (2026-05-13) — Mood timeline strip on Today.
 *
 * Kid-facing strip below KidHeaderStrips. Hour-by-hour zone color bars
 * derived from `today.moodTimelineStrip`. Self-hides when there are no
 * mood entries today (no info → render nothing).
 *
 * Calm, low-words: just dots in a row with hour labels under them.
 */
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function tzOffsetMinutes(): number {
  // Date#getTimezoneOffset returns minutes AHEAD of local time (e.g. EDT
  // returns +240). We want minutes FROM UTC (EDT = -240).
  return -new Date().getTimezoneOffset();
}

export default function MoodTimelineStrip() {
  const localDateIso = useMemo(todayLocalIso, []);
  const tzOffsetMin = useMemo(tzOffsetMinutes, []);

  const q = (trpc as any).today?.moodTimelineStrip?.useQuery?.(
    { localDateIso, tzOffsetMin },
    { staleTime: 60_000 },
  );

  const data = q?.data as
    | {
        cells: Array<{
          hour: number;
          hourLabel: string;
          zone: "green" | "yellow" | "red" | null;
          color: string;
          note: string | null;
        }>;
        hasAny: boolean;
      }
    | undefined;

  // Self-hide when there's no mood data for today.
  if (!data || !data.hasAny || data.cells.length === 0) return null;

  return (
    <Card
      className="classroom-card p-3 mb-3"
      data-testid="kid-mood-timeline-strip"
      data-kid-header-strips
    >
      <div className="text-[11px] font-semibold tracking-wide uppercase opacity-70 mb-2">
        How today felt
      </div>
      <div
        className="flex items-stretch gap-1"
        role="list"
        aria-label="Hour by hour mood timeline"
      >
        {data.cells.map((c) => (
          <div
            key={c.hour}
            role="listitem"
            title={
              c.zone
                ? `${c.hourLabel} · ${c.zone}${c.note ? ` — ${c.note}` : ""}`
                : `${c.hourLabel} · no entry`
            }
            className="flex-1 flex flex-col items-center gap-1"
          >
            <div
              className="w-full h-6 rounded-md border border-white/10"
              style={{
                backgroundColor: c.color,
                opacity: c.zone ? 0.95 : 0.25,
              }}
              data-zone={c.zone ?? "none"}
              data-hour={c.hour}
            />
            <div className="text-[10px] opacity-70">{c.hourLabel}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
