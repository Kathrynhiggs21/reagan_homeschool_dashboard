import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

/**
 * Push 59 (2026-05-13) — Kid-friendly micro strips at the top of Today.
 *
 * Three calm chalk-style cards that Reagan can read at a glance:
 *   1. Today's progress — % of today's school work done so far
 *   2. Mood — last 3 days as dots so she sees her own arc
 *   3. Pick up where I left off — title + Jump button to next unfinished block
 *
 * No raw analytics jargon; everything is plain-language and dismisses
 * itself if there's no data. The adult version (HomeAnalyticsStrip) is
 * unchanged and still gates inside the unlocked block.
 */
export default function KidHeaderStrips() {
  const coverage = trpc.today.coverageWithActuals.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const mood = trpc.today.moodStrip.useQuery({ days: 3 }, { refetchOnWindowFocus: false });
  const resume = trpc.today.resumePointer.useQuery(undefined, { refetchOnWindowFocus: false });

  const cov = coverage.data || [];
  const moodDays = mood.data || [];
  const next = resume.data;

  // Effective coverage across planned subjects (off-plan subjects ignored
  // for the kid view to keep the number simple).
  const planned = cov.filter((r) => !r.offPlan);
  const totalToday = planned.reduce((s, r) => s + r.plannedTotal, 0);
  const effectiveDone = planned.reduce(
    (s, r) => s + Math.round((r.effectivePct / 100) * r.plannedTotal),
    0
  );
  const pctToday = totalToday > 0 ? Math.round((effectiveDone / totalToday) * 100) : 0;

  // Hide whole strip when nothing useful is loaded yet.
  if (cov.length === 0 && moodDays.length === 0 && !next) return null;

  // Friendly progress label.
  const progressLabel =
    totalToday === 0
      ? "Day not started yet"
      : pctToday >= 100
        ? "All done — nice work!"
        : pctToday >= 50
          ? "You're past halfway"
          : pctToday > 0
            ? "Off to a start"
            : "Ready when you are";

  return (
    <div
      data-kid-header-strips
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}
    >
      {/* 1. Today's progress */}
      <div
        className="cozy-card rounded-2xl p-3 text-foreground"
        aria-label="Today's progress"
      >
        <div className="text-[11px] uppercase tracking-wide font-semibold opacity-70">
          Today
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <div className="text-2xl font-bold">{pctToday}%</div>
          <div className="text-xs opacity-70">
            {effectiveDone}/{totalToday || 0} blocks
          </div>
        </div>
        <div className="mt-2 h-2 rounded-full overflow-hidden bg-foreground/10">
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${pctToday}%`, background: "#22c55e" }}
          />
        </div>
        <div className="text-xs mt-2 opacity-80">
          {progressLabel}
        </div>
      </div>

      {/* 2. 3-day mood dots */}
      <div
        className="cozy-card rounded-2xl p-3 text-foreground"
        aria-label="Last 3 days mood"
      >
        <div className="text-[11px] uppercase tracking-wide font-semibold opacity-70">
          How I felt
        </div>
        <div className="flex items-center gap-3 mt-2">
          {moodDays
            .slice()
            .reverse()
            .map((d) => {
              const color =
                d.zone === "green"
                  ? "#22c55e"
                  : d.zone === "yellow"
                    ? "#eab308"
                    : d.zone === "red"
                      ? "#ef4444"
                      : "#d1c8b3";
              const labelText =
                d.zone === "green"
                  ? "Good"
                  : d.zone === "yellow"
                    ? "Okay"
                    : d.zone === "red"
                      ? "Rough"
                      : "—";
              return (
                <div key={d.date} className="flex flex-col items-center" title={`${d.date}: ${labelText}`}>
                  <span
                    className="w-6 h-6 rounded-full"
                    style={{ background: color, boxShadow: "0 1px 0 rgba(0,0,0,0.18)" }}
                  />
                  <span className="text-[10px] mt-1 opacity-70">
                    {d.date.slice(5)}
                  </span>
                </div>
              );
            })}
        </div>
        <div className="text-xs mt-2 opacity-80">
          Last 3 days
        </div>
      </div>

      {/* 3. Resume / All caught up */}
      {next ? (
        <Link href={`/today#block-${next.id}`}>
          <div
            className="cozy-card rounded-2xl p-3 text-foreground cursor-pointer hover:brightness-110 transition border-2 border-amber-400/50"
            aria-label="Pick up where you left off"
          >
            <div className="text-[11px] uppercase tracking-wide font-semibold text-amber-400">
              Pick up where I left off
            </div>
            <div className="font-bold mt-0.5 truncate">{next.title || "Next block"}</div>
            <div className="text-xs capitalize opacity-75">
              {next.subjectSlug}
            </div>
            <div className="text-xs font-bold mt-1 text-amber-400">
              Jump →
            </div>
          </div>
        </Link>
      ) : (
        <div
          className="cozy-card rounded-2xl p-3 text-foreground border-2 border-emerald-400/50"
          aria-label="All caught up"
        >
          <div className="text-[11px] uppercase tracking-wide font-semibold text-emerald-400">
            Nice!
          </div>
          <div className="font-bold mt-0.5">All caught up today</div>
          <div className="text-xs mt-1 opacity-80">
            No more blocks waiting.
          </div>
        </div>
      )}
    </div>
  );
}
