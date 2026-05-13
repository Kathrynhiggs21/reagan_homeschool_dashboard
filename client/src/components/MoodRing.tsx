/**
 * Push 81 (2026-05-13) — Mood ring visual for the adult Analytics page.
 *
 * Calm SVG ring with 7 segments (one per day, oldest at top-left moving
 * clockwise). Each segment is colored by Reagan's logged zone for that
 * day — green/yellow/red/blue/gray — using the same palette already in
 * KidHeaderStrips and HomeAnalyticsStrip so adults learn one color key
 * once.
 *
 * Self-hides when every day in the window is null (no info → render
 * nothing), per Mom's "don't show empty cards" rule.
 *
 * Tooltip-on-hover shows the date + label so Mom can hover a rough day
 * to investigate without leaving the page.
 *
 * Pure presentational — reads trpc.today.moodStrip and computes geometry
 * deterministically. No state.
 */

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Zone = "green" | "yellow" | "red" | "blue" | "gray" | null | undefined;

function zoneColor(zone: Zone): string {
  switch (zone) {
    case "green":  return "#22c55e";
    case "yellow": return "#eab308";
    case "red":    return "#ef4444";
    case "blue":   return "#60a5fa";
    case "gray":   return "#94a3b8";
    default:       return "#d1c8b3"; // soft cream = "no entry"
  }
}

function zoneLabel(zone: Zone): string {
  switch (zone) {
    case "green":  return "Good day";
    case "yellow": return "Okay";
    case "red":    return "Rough";
    case "blue":   return "Quiet";
    case "gray":   return "Tired";
    default:       return "No mood logged";
  }
}

function formatDate(iso: string): string {
  // "2026-05-13" → "Wed May 13"
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS_OUTER = 84;
const RADIUS_INNER = 56;

function describeSegment(index: number, total: number): string {
  const startAngle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const endAngle = ((index + 1) / total) * 2 * Math.PI - Math.PI / 2;
  // gap between segments
  const gap = 0.02;
  const a0 = startAngle + gap;
  const a1 = endAngle - gap;
  const x0 = CENTER + RADIUS_OUTER * Math.cos(a0);
  const y0 = CENTER + RADIUS_OUTER * Math.sin(a0);
  const x1 = CENTER + RADIUS_OUTER * Math.cos(a1);
  const y1 = CENTER + RADIUS_OUTER * Math.sin(a1);
  const x2 = CENTER + RADIUS_INNER * Math.cos(a1);
  const y2 = CENTER + RADIUS_INNER * Math.sin(a1);
  const x3 = CENTER + RADIUS_INNER * Math.cos(a0);
  const y3 = CENTER + RADIUS_INNER * Math.sin(a0);
  return [
    `M ${x0} ${y0}`,
    `A ${RADIUS_OUTER} ${RADIUS_OUTER} 0 0 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${RADIUS_INNER} ${RADIUS_INNER} 0 0 0 ${x3} ${y3}`,
    "Z",
  ].join(" ");
}

export function MoodRing() {
  const { data, isLoading } = trpc.today.moodStrip.useQuery({ days: 7 });

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  // No-info rule: if every day in the window has zone=null, hide entirely.
  const hasAny = data.some((d) => d.zone !== null && d.zone !== undefined);
  if (!hasAny) return null;

  // Oldest first → clockwise from top.
  const ordered = data.slice().reverse();

  // Aggregate count for the center label.
  const counts: Record<string, number> = { good: 0, rough: 0, other: 0 };
  for (const d of ordered) {
    if (d.zone === "green") counts.good++;
    else if (d.zone === "red") counts.rough++;
    else if (d.zone) counts.other++;
  }
  const centerTop = `${counts.good}`;
  const centerBottom = `good day${counts.good === 1 ? "" : "s"}`;

  return (
    <Card data-mood-ring className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-700">
          7-day mood ring
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Reagan's mood over the last 7 days"
        >
          {ordered.map((d, i) => (
            <path
              key={d.date}
              d={describeSegment(i, ordered.length)}
              fill={zoneColor(d.zone as Zone)}
              opacity={d.zone ? 0.92 : 0.35}
            >
              <title>{`${formatDate(d.date)} — ${zoneLabel(d.zone as Zone)}`}</title>
            </path>
          ))}
          {/* Center label */}
          <text
            x={CENTER}
            y={CENTER - 4}
            textAnchor="middle"
            className="fill-slate-800"
            style={{ fontSize: 28, fontWeight: 700 }}
          >
            {centerTop}
          </text>
          <text
            x={CENTER}
            y={CENTER + 16}
            textAnchor="middle"
            className="fill-slate-500"
            style={{ fontSize: 11 }}
          >
            {centerBottom}
          </text>
        </svg>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <Legend color="#22c55e" label="Good" />
          <Legend color="#eab308" label="Okay" />
          <Legend color="#ef4444" label="Rough" />
          <Legend color="#60a5fa" label="Quiet" />
          <Legend color="#94a3b8" label="Tired" />
          <Legend color="#d1c8b3" label="No log" />
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-3 h-3 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
