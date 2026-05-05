/**
 * SubjectSparklines — per-subject 30-day score trend strip (adult-only).
 * Reads submissions.list (limit 200) and groups by subjectSlug. Pure SVG.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { groupSubmissionsForSparklines } from "@/lib/sparklineGrouping";

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

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 160;
  const H = 36;
  if (values.length === 0)
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9">
        <text x={W / 2} y={H / 2 + 3} textAnchor="middle" fontSize={10} fill="rgba(140,140,140,0.5)">
          no data yet
        </text>
      </svg>
    );
  const max = Math.max(100, ...values);
  const min = 0;
  const span = max - min || 1;
  const step = values.length === 1 ? 0 : (W - 4) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = 2 + i * step;
    const y = H - 2 - ((v - min) / span) * (H - 4);
    return `${x},${y}`;
  });
  const last = values[values.length - 1];
  const lastX = 2 + (values.length - 1) * step;
  const lastY = H - 2 - ((last - min) / span) * (H - 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} />
      <circle cx={lastX} cy={lastY} r={3} fill={color} stroke="#fff" strokeWidth={1.2} />
    </svg>
  );
}

export default function SubjectSparklines() {
  const subs = trpc.submissions.list.useQuery({ limit: 200 });

  const grouped = useMemo(
    () => groupSubmissionsForSparklines((subs.data as any[]) || [], 30),
    [subs.data],
  );

  const slugs = Object.keys(grouped).sort((a, b) => grouped[b].n - grouped[a].n);

  // "Don't show if no info" rule — hide the whole card when 0 subjects.
  if (slugs.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-sm">Subject Sparklines — last 30 days</div>
        <div className="text-[11px] opacity-60 tabular-nums">{slugs.length} subjects</div>
      </div>
      {(
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {slugs.map((slug) => {
            const g = grouped[slug];
            return (
              <div
                key={slug}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{
                  border: `1px solid ${SUBJECT_COLOR[slug] || "#999"}33`,
                  background: `${SUBJECT_COLOR[slug] || "#999"}10`,
                }}
              >
                <div className="w-20 shrink-0">
                  <div
                    className="text-[11px] uppercase tracking-wide font-semibold"
                    style={{ color: SUBJECT_COLOR[slug] || "#999" }}
                  >
                    {SUBJECT_LABEL[slug] || slug}
                  </div>
                  <div className="text-base font-bold tabular-nums">{g.avg}%</div>
                  <div className="text-[10px] opacity-60">{g.n} submission{g.n !== 1 ? "s" : ""}</div>
                </div>
                <div className="flex-1">
                  <Sparkline values={g.values} color={SUBJECT_COLOR[slug] || "#999"} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

