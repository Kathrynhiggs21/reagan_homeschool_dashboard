import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { DescriptionWithLinks } from "@/components/DescriptionWithLinks";

/**
 * Adult-facing micro-analytics at the top of Today:
 * - Per-subject % complete bar (tap → Analytics)
 * - 3-day mood dots (tap → Timeline)
 * - Resume-where-we-left-off card (tap → jumps to the block)
 */
export default function HomeAnalyticsStrip() {
  // Slice 4.5: source of truth is `actualAgendaEntries` (merged with planned blocks via effectivePct)
  const coverage = trpc.today.coverageWithActuals.useQuery();
  const mood = trpc.today.moodStrip.useQuery({ days: 3 });
  const resume = trpc.today.resumePointer.useQuery();

  const cov = coverage.data || [];
  const moodDays = mood.data || [];
  const next = resume.data;

  // Show "effective" coverage (planned-done + actual-entries, capped at planned total).
  // Off-plan subjects (no planned blocks but Mom/Grandma logged actuals) count as 100% effective.
  const planned = cov.filter((r) => !r.offPlan);
  const totalToday = planned.reduce((s, r) => s + r.plannedTotal, 0);
  const effectiveDone = planned.reduce((s, r) => s + Math.round((r.effectivePct / 100) * r.plannedTotal), 0);
  const pctToday = totalToday > 0 ? Math.round((effectiveDone / totalToday) * 100) : 0;
  const offPlanCount = cov.filter((r) => r.offPlan).reduce((s, r) => s + r.actualEntries, 0);

  // "Don't show if no info" rule — if there's truly nothing to display
  // (no coverage, no mood logs, and no resume pointer), hide the whole strip
  // instead of a row of zero-state placeholders.
  if (cov.length === 0 && moodDays.length === 0 && !next) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
      <Link href="/analytics">
        <div className="classroom-card rounded-2xl p-3 cursor-pointer hover:opacity-90 transition">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Today's coverage</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <div className="text-2xl font-bold">{pctToday}%</div>
            <div className="text-xs text-muted-foreground">{effectiveDone}/{totalToday || 0} blocks</div>
          </div>
          <div className="mt-2 space-y-1">
            {cov.slice(0, 5).map((r) => (
              <div key={r.subjectSlug} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 capitalize text-muted-foreground">{r.subjectSlug}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden inner-panel">
                  <div className="h-2 bg-emerald-400" style={{ width: `${r.effectivePct}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{r.effectivePct}%</span>
                {r.offPlan && <span className="text-[10px] text-amber-500 font-semibold">off-plan</span>}
              </div>
            ))}
            {cov.length === 0 && <div className="text-xs text-muted-foreground">No plan today yet.</div>}
            {offPlanCount > 0 && (
              <div className="text-[10px] text-amber-700 mt-1">+{offPlanCount} off-plan {offPlanCount === 1 ? "entry" : "entries"} captured today</div>
            )}
          </div>
        </div>
      </Link>

      <Link href="/timeline">
        <div className="classroom-card rounded-2xl p-3 cursor-pointer hover:opacity-90 transition">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">3-day mood</div>
          <div className="flex items-center gap-2 mt-1">
            {moodDays.slice().reverse().map((d) => {
              const color = d.zone === "green" ? "#22c55e" : d.zone === "yellow" ? "#eab308" : d.zone === "red" ? "#ef4444" : "#cbd5e1";
              return (
                <div key={d.date} className="flex flex-col items-center">
                  <span className="w-5 h-5 rounded-full" style={{ background: color }} />
                  <span className="text-[10px] text-muted-foreground mt-1">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-2">Tap → Timeline</div>
        </div>
      </Link>

      {next ? (
        <Link href={`/schedule#block-${next.id}`}>
          <div className="classroom-card rounded-2xl p-3 cursor-pointer hover:opacity-90 transition" style={{ borderColor: "rgba(245,158,11,0.5)" }}>
            <div className="text-[11px] uppercase tracking-wide text-amber-500 font-semibold">Resume where you left off</div>
            <div className="font-bold mt-0.5 truncate">{next.title || "Next block"}</div>
            <div className="text-xs text-muted-foreground capitalize">{next.subjectSlug}</div>
            {next.description && <DescriptionWithLinks text={next.description} embeds={false} className="text-xs text-muted-foreground line-clamp-2 mt-1" />}
            <div className="text-xs font-semibold text-amber-500 mt-1">Jump →</div>
          </div>
        </Link>
      ) : (
        <div className="classroom-card rounded-2xl p-3">
          <div className="text-[11px] uppercase tracking-wide text-emerald-500 font-semibold">Nice!</div>
          <div className="font-bold mt-0.5">All caught up today</div>
          <div className="text-xs text-muted-foreground mt-1">No more blocks waiting.</div>
        </div>
      )}
    </div>
  );
}
