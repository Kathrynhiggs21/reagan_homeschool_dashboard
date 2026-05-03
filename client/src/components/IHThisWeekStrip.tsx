import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";

/**
 * IHThisWeekStrip — surfaces what Reagan's Indian Hill 5th-grade class is
 * working on this week (sourced from Wells's Q4 inquiry guide + Froehlich's
 * weekly updates). Helps her feel synchronized with peers, not parallel.
 *
 * Visual: collapsed "🏫 At Indian Hill this week — tap to peek" pill that
 * expands into a per-subject list. Hidden if no curriculum is loaded.
 */

const SUBJECT_META: Record<string, { label: string; emoji: string; color: string }> = {
  math:    { label: "Math",          emoji: "🧮", color: "#fbbf24" },
  ela:     { label: "Reading & Writing", emoji: "📚", color: "#60a5fa" },
  science: { label: "Science",       emoji: "🔬", color: "#34d399" },
  ss:      { label: "Social Studies", emoji: "🌎", color: "#f472b6" },
};

export default function IHThisWeekStrip() {
  // Disabled May 2026: Reagan's @ihsd.us school account is dead, so the
  // "At Indian Hill this week" banner pulls stale data and adds clutter.
  // We keep the component for backwards-compatible imports but render nothing.
  return null;
  // eslint-disable-next-line no-unreachable
  const q = trpc.weeklyTopics.thisWeek.useQuery(undefined, { refetchOnWindowFocus: false });
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const data: any = q.data;
    const byS: Record<string, string[]> = {};
    if (data?.topics) {
      for (const r of data.topics) {
        const list = Array.isArray(r.topics) ? r.topics : [];
        if (list.length) byS[r.subjectSlug] = list;
      }
    }
    return byS;
  }, [q.data]);

  const data: any = q.data;
  const hasAny = Object.keys(grouped).length > 0;
  if (q.isLoading || !hasAny) return null;

  return (
    <Card className="classroom-card overflow-hidden border-l-4" style={{ borderLeftColor: "#e6c200" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition"
      >
        <span className="text-2xl shrink-0" aria-hidden>🏫</span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm">At Indian Hill this week</div>
          <div className="text-xs text-neutral-400">
            {data?.ihWeekTag ? `${data.ihWeekTag} · ` : ""}
            {Object.keys(grouped).length} subject{Object.keys(grouped).length === 1 ? "" : "s"} · tap to {open ? "hide" : "peek"}
          </div>
        </div>
        <span className="text-xs text-neutral-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          {Object.entries(grouped).map(([slug, topics]) => {
            const meta = SUBJECT_META[slug] || { label: slug, emoji: "✨", color: "#94a3b8" };
            return (
              <div key={slug} className="flex items-start gap-2">
                <span className="text-base shrink-0 mt-0.5" aria-hidden>{meta.emoji}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</div>
                  <ul className="text-xs text-neutral-300 list-disc pl-4 leading-relaxed">
                    {topics.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground italic pt-1">
            You don't have to do all of this — Kiwi will pick the parts that fit you.
          </p>
        </div>
      )}
    </Card>
  );
}
