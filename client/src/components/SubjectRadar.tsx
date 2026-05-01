/**
 * SubjectRadar — pure SVG radar/spider chart of per-subject 30-day rolling averages.
 * Adult-only. Reads `submissions.subjectGrades` shape: [{ subjectSlug, average, n }].
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";

type Row = { subjectSlug: string; average: number; n: number };

const SUBJECT_ORDER = ["math", "science", "social", "ela", "specials", "general"];
const SUBJECT_LABEL: Record<string, string> = {
  math: "Math",
  science: "Science",
  social: "Social",
  ela: "ELA",
  specials: "Specials",
  general: "Other",
};
const SUBJECT_COLOR: Record<string, string> = {
  math: "#ff8a3d",
  science: "#5dd39e",
  social: "#b48cff",
  ela: "#ff7a8a",
  specials: "#5fb3ff",
  general: "#ffce3a",
};

export default function SubjectRadar() {
  const q = trpc.submissions.subjectGrades.useQuery();
  const rows: Row[] = useMemo(() => (q.data as any[]) || [], [q.data]);

  // index by subject so missing subjects render at radius=0
  const bySlug = useMemo(() => {
    const m: Record<string, Row> = {};
    for (const r of rows) m[r.subjectSlug] = r;
    return m;
  }, [rows]);

  const W = 320;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const R = 110;

  const axes = SUBJECT_ORDER;
  const N = axes.length;

  const polar = (i: number, radius: number) => {
    const angle = -Math.PI / 2 + (i / N) * Math.PI * 2;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const;
  };

  // grid rings at 25 / 50 / 75 / 100
  const rings = [0.25, 0.5, 0.75, 1].map((p) => {
    const pts = axes.map((_, i) => polar(i, R * p).join(",")).join(" ");
    return { p, pts };
  });

  // data polygon
  const dataPts = axes.map((slug, i) => {
    const v = bySlug[slug]?.average ?? 0;
    const r = (Math.max(0, Math.min(100, v)) / 100) * R;
    return polar(i, r).join(",");
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">Subject Radar — last 30 days</div>
        <div className="text-[11px] opacity-60 tabular-nums">
          {rows.length} subjects · avg{" "}
          {rows.length
            ? Math.round(rows.reduce((a, b) => a + (b.average || 0), 0) / rows.length)
            : 0}
          %
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-72"
        role="img"
        aria-label="Subject radar showing rolling averages per subject"
      >
        {/* grid rings */}
        {rings.map((r, i) => (
          <polygon
            key={i}
            points={r.pts}
            fill="none"
            stroke="rgba(140,140,140,0.25)"
            strokeWidth={1}
            strokeDasharray={i < rings.length - 1 ? "3,3" : undefined}
          />
        ))}
        {/* axis lines + labels */}
        {axes.map((slug, i) => {
          const [x, y] = polar(i, R);
          const [lx, ly] = polar(i, R + 18);
          return (
            <g key={slug}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(140,140,140,0.18)" strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                fontSize={11}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={SUBJECT_COLOR[slug] || "#999"}
                style={{ fontWeight: 600 }}
              >
                {SUBJECT_LABEL[slug] || slug}
              </text>
            </g>
          );
        })}
        {/* data polygon */}
        <polygon
          points={dataPts.join(" ")}
          fill="rgba(127,227,196,0.25)"
          stroke="#7fe3c4"
          strokeWidth={2}
        />
        {/* per-subject dot */}
        {axes.map((slug, i) => {
          const v = bySlug[slug]?.average ?? 0;
          const r = (Math.max(0, Math.min(100, v)) / 100) * R;
          const [x, y] = polar(i, r);
          return (
            <circle
              key={slug + "-dot"}
              cx={x}
              cy={y}
              r={4}
              fill={SUBJECT_COLOR[slug] || "#999"}
              stroke="#fff"
              strokeWidth={1.5}
            />
          );
        })}
        {/* center label */}
        <text x={cx} y={cy} textAnchor="middle" fontSize={10} fill="rgba(140,140,140,0.55)">
          0%
        </text>
      </svg>
    </Card>
  );
}
