/**
 * CurriculumCoverageArcs — adult-only SVG ring-arc widget.
 *
 * Push 62 (2026-05-13). Renders one calm ring per subject showing
 * "topics done / topics total" pulled from trpc.curriculum.progress.
 *
 * Why arcs (not bars): mom asked for "more visual, less spreadsheet".
 * Six small rings read as a glance instead of six bars stacked on a
 * gridline. Each ring also surfaces a numeric pct + done/total under
 * it so the data is still legible.
 *
 * Don't-show-if-no-info rule: if the procedure returns 0 rows OR every
 * subject has 0 total topics, the entire card hides (returns null).
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";

type Row = { subject: string; done: number; total: number; pct: number };

/**
 * Subject display order (mirrors SubjectRadar so the two visualizations
 * read consistently when stacked on the Analytics page).
 */
const SUBJECT_ORDER = ["Math", "ELA", "Science", "Social", "Specials", "Other"] as const;

/**
 * Subject palette — matches SubjectRadar so adults learn the colors once.
 * Keys are the TitleCase shape returned by `curriculumProgress()` SQL,
 * not the kid-side slug used by SubjectRadar.
 */
export const SUBJECT_ARC_COLOR: Record<string, string> = {
  Math: "#ff8a3d",
  ELA: "#ff7a8a",
  Science: "#5dd39e",
  Social: "#b48cff",
  Specials: "#5fb3ff",
  Other: "#ffce3a",
};

function ArcRing({
  pct,
  color,
  size = 96,
}: {
  pct: number;
  color: string;
  size?: number;
}) {
  // Geometry: a 270deg arc (so the ring opens at the bottom for a
  // "progress dial" feel rather than a closed donut). Stroke length
  // is computed from the arc length and tweened by `pct`.
  const stroke = 8;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arcDeg = 270;
  const arcLen = (arcDeg / 360) * 2 * Math.PI * r;
  const offset = arcLen - (Math.max(0, Math.min(100, pct)) / 100) * arcLen;
  // Start angle = 135deg from positive x-axis so the gap centers at the
  // bottom of the ring.
  const startA = (135 * Math.PI) / 180;
  const endA = (45 * Math.PI) / 180 + 2 * Math.PI;
  const sx = cx + r * Math.cos(startA);
  const sy = cy + r * Math.sin(startA);
  const ex = cx + r * Math.cos(endA);
  const ey = cy + r * Math.sin(endA);
  const largeArc = 1; // 270deg > 180deg so always large
  const arcPath = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {/* Track */}
      <path
        d={arcPath}
        fill="none"
        stroke="rgba(140,140,140,0.18)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {/* Filled portion */}
      <path
        d={arcPath}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${arcLen} ${arcLen}`}
        strokeDashoffset={offset}
      />
      {/* Center label */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.26}
        style={{ fontWeight: 700 }}
        fill="currentColor"
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

export default function CurriculumCoverageArcs() {
  const q = trpc.curriculum.progress.useQuery();
  const rows: Row[] = useMemo(
    () => ((q.data as any[]) || []) as Row[],
    [q.data],
  );

  // Sort to canonical SUBJECT_ORDER, dropping subjects that don't
  // appear in the catalog (rare; happens during seed transitions).
  const ordered = useMemo(() => {
    const bySubject: Record<string, Row> = {};
    for (const r of rows) bySubject[r.subject] = r;
    return SUBJECT_ORDER.map((s) => bySubject[s]).filter(Boolean) as Row[];
  }, [rows]);

  // Don't-show-if-no-info: hide entire card when there are no rows OR
  // every subject has 0 total topics (catalog hasn't been seeded).
  const totalAcross = ordered.reduce((s, r) => s + (r.total || 0), 0);
  if (ordered.length === 0 || totalAcross === 0) return null;

  const overallPct = Math.round(
    (ordered.reduce((s, r) => s + (r.done || 0), 0) / Math.max(1, totalAcross)) * 100,
  );

  return (
    <Card className="cozy-card p-4" data-testid="curriculum-coverage-arcs">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="font-semibold text-sm">Curriculum coverage by subject</div>
          <div className="text-[11px] opacity-60">
            Topics marked <span className="font-medium">done</span> in the curriculum catalog
          </div>
        </div>
        <div className="text-[11px] opacity-70 tabular-nums">
          {overallPct}% overall · {ordered.length} subjects
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 place-items-center">
        {ordered.map((r) => {
          const color = SUBJECT_ARC_COLOR[r.subject] ?? "#999";
          return (
            <div key={r.subject} className="flex flex-col items-center gap-1.5">
              <ArcRing pct={r.pct} color={color} />
              <div
                className="text-[12px] font-semibold"
                style={{ color }}
              >
                {r.subject}
              </div>
              <div className="text-[10px] opacity-60 tabular-nums">
                {r.done}/{r.total}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
