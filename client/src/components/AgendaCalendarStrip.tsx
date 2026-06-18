import { useMemo } from "react";
import { subjectTint } from "@/lib/subjectColors";

/**
 * AgendaCalendarStrip — 2026-05-30
 *
 * Renders a single day's planned blocks as a vertical calendar-style timeline
 * (8 AM → 5 PM by default), with each block drawn as a colored bar at its
 * `startTime` for `durationMin`. Subject color comes from `subjectColors`.
 *
 * Designed to drop into the Schedule page Day view as the "agenda for the
 * day, but as a calendar layer" the user asked for.
 *
 * Behavior:
 *   - Blocks WITH a startTime are placed precisely.
 *   - Blocks WITHOUT a startTime are flowed sequentially starting at 9:00 AM
 *     and stacked underneath any timed blocks (mirrors the print PDF behavior
 *     in calendarFeed.ts).
 *   - Off days render a single banner "No school today" so the timeline isn't
 *     empty.
 *   - When zero blocks are scheduled, the component returns null (per the
 *     standing rule "Don't show if no info").
 */

export interface AgendaBlockLite {
  id: number | string;
  title: string;
  durationMin?: number | null;
  minutes?: number | null; // schema uses `durationMin` but legacy code uses `minutes`
  startTime?: string | null; // "HH:MM" 24h
  subjectSlug?: string | null;
  status?: string | null;
}

interface Props {
  date: Date;
  blocks: AgendaBlockLite[];
  isOff?: boolean;
  offLabel?: string | null;
  /** Hour to start the timeline (24h, 0-23). Default 7. */
  startHour?: number;
  /** Hour to end the timeline (exclusive). Default 18 (6 PM). */
  endHour?: number;
  /** Pixels per hour. Default 60 → 1 minute = 1 px. */
  pxPerHour?: number;
  /** Optional click handler when a block bar is tapped. */
  onBlockClick?: (block: AgendaBlockLite) => void;
}

interface PositionedBlock extends AgendaBlockLite {
  startMin: number; // minutes since timeline startHour
  endMin: number;
}

function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return { h, m: mm };
}

function durationOf(b: AgendaBlockLite): number {
  const d = (b.durationMin ?? b.minutes ?? 30) as number;
  return Math.max(5, Math.min(240, Math.round(d)));
}

/**
 * Lay blocks onto a single day's minute axis.
 * Blocks with `startTime` get exact placement; the rest flow sequentially.
 */
export function layoutBlocks(
  blocks: AgendaBlockLite[],
  startHour: number,
  endHour: number,
): PositionedBlock[] {
  const startBoundary = startHour * 60;
  const endBoundary = endHour * 60;
  const out: PositionedBlock[] = [];
  // Track flow cursor for blocks without startTime — start at 10 AM (the
  // summer default day start, or the timeline's startHour, whichever is later).
  let flowCursor = Math.max(10 * 60, startBoundary);

  // First pass: place timed blocks; advance the flow cursor past them so
  // untimed blocks slot AFTER the latest timed block.
  for (const b of blocks) {
    const t = b.startTime ? parseHHMM(b.startTime) : null;
    if (!t) continue;
    const startAbs = t.h * 60 + t.m;
    const dur = durationOf(b);
    out.push({
      ...b,
      startMin: startAbs - startBoundary,
      endMin: startAbs - startBoundary + dur,
    });
    flowCursor = Math.max(flowCursor, startAbs + dur + 5);
  }

  // Second pass: untimed blocks flow sequentially.
  for (const b of blocks) {
    if (b.startTime) continue;
    const dur = durationOf(b);
    const start = flowCursor;
    out.push({
      ...b,
      startMin: start - startBoundary,
      endMin: start - startBoundary + dur,
    });
    flowCursor = start + dur + 5;
  }

  // Clamp anything that overruns the visible window so we don't draw off the bottom.
  const visibleSpan = endBoundary - startBoundary;
  for (const p of out) {
    if (p.endMin > visibleSpan) p.endMin = visibleSpan;
    if (p.startMin < 0) p.startMin = 0;
    if (p.endMin <= p.startMin) p.endMin = p.startMin + 5;
  }
  // Sort by startMin so the DOM order matches visual order (helps screen readers).
  out.sort((a, b) => a.startMin - b.startMin);
  return out;
}

function fmtClock(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function AgendaCalendarStrip({
  date,
  blocks,
  isOff,
  offLabel,
  startHour = 7,
  endHour = 18,
  pxPerHour = 60,
  onBlockClick,
}: Props) {
  const placed = useMemo(
    () => layoutBlocks(blocks, startHour, endHour),
    [blocks, startHour, endHour],
  );

  // Hide entirely when there's nothing to show (standing rule: "don't show
  // if no info").
  if (!isOff && placed.length === 0) return null;

  const totalMin = (endHour - startHour) * 60;
  const totalPx = totalMin * (pxPerHour / 60);
  const hourMarks = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  // Quick "now" indicator (only show if the date is today).
  const now = new Date();
  const isToday =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() - startHour * 60 : -1;
  const nowVisible = nowMin >= 0 && nowMin <= totalMin;

  return (
    <div
      className="rounded-xl border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-800/60 p-3"
      data-testid="agenda-calendar-strip"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-display font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Day at a glance
        </div>
        <div className="text-[11px] text-muted-foreground">
          {fmtClock(startHour, 0)} – {fmtClock(endHour, 0)}
        </div>
      </div>

      {isOff && (
        <div className="rounded-lg bg-pink-100 border border-pink-300 text-pink-900 px-3 py-2 mb-3 text-sm">
          <span className="font-display font-semibold">No school today.</span>{" "}
          {offLabel ? <span className="opacity-80">{offLabel}</span> : null}
        </div>
      )}

      <div className="relative" style={{ height: totalPx }}>
        {/* Hour grid lines + labels */}
        {hourMarks.map((h, i) => (
          <div
            key={h}
            className="absolute left-0 right-0 flex items-center"
            style={{ top: i * pxPerHour }}
          >
            <div className="w-12 shrink-0 text-[10px] text-muted-foreground font-mono pr-2 text-right">
              {fmtClock(h, 0)}
            </div>
            <div className="flex-1 border-t border-amber-200/60 dark:border-amber-800/40" />
          </div>
        ))}

        {/* Now line */}
        {nowVisible && (
          <div
            className="absolute left-12 right-0 z-20 pointer-events-none"
            style={{ top: nowMin * (pxPerHour / 60) - 1 }}
          >
            <div className="h-[2px] bg-rose-500/90 shadow" />
            <div className="absolute -top-2 -left-1 w-3 h-3 rounded-full bg-rose-500 shadow" />
          </div>
        )}

        {/* Block bars */}
        {placed.map((b, i) => {
          const t = subjectTint(b.subjectSlug);
          const top = b.startMin * (pxPerHour / 60);
          const height = Math.max(18, (b.endMin - b.startMin) * (pxPerHour / 60));
          const isDone = b.status === "complete" || b.status === "done";
          return (
            <button
              key={`${b.id}-${i}`}
              type="button"
              onClick={onBlockClick ? () => onBlockClick(b) : undefined}
              title={b.title + (b.startTime ? ` · ${b.startTime}` : "")}
              className="absolute left-12 right-2 rounded-lg px-2.5 py-1 text-left transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-400"
              style={{
                top,
                height,
                background: `${t.border}26`,
                border: `1px solid ${t.border}`,
                borderLeft: `5px solid ${t.border}`,
                color: "#1a1a1a",
                opacity: isDone ? 0.55 : 1,
              }}
              data-testid={`agenda-strip-block-${b.id}`}
            >
              <div className="flex items-center gap-1.5 text-[12px] font-semibold leading-tight truncate">
                <span aria-hidden>{t.emoji}</span>
                <span className="truncate">{b.title}</span>
                {isDone ? <span className="ml-auto text-[10px] opacity-80">✓</span> : null}
              </div>
              {height > 32 && (
                <div className="text-[10px] opacity-80 leading-tight mt-0.5 truncate">
                  {b.startTime ? `${b.startTime} · ` : ""}
                  {(b.durationMin ?? b.minutes ?? 30)} min
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AgendaCalendarStrip;
