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
        className="rounded-2xl p-3 shadow-sm border-2"
        style={{
          background: "rgba(255, 250, 230, 0.94)",
          borderColor: "rgba(160, 120, 60, 0.45)",
          color: "#2a2010",
        }}
        aria-label="Today's progress"
      >
        <div
          className="text-[11px] uppercase tracking-wide font-semibold"
          style={{ color: "#7a4d12" }}
        >
          Today
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <div className="text-2xl font-bold">{pctToday}%</div>
          <div className="text-xs" style={{ color: "rgba(42,32,16,0.7)" }}>
            {effectiveDone}/{totalToday || 0} blocks
          </div>
        </div>
        <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "rgba(160,120,60,0.18)" }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${pctToday}%`, background: "#22c55e" }}
          />
        </div>
        <div className="text-xs mt-2" style={{ color: "#3a2a00" }}>
          {progressLabel}
        </div>
      </div>

      {/* 2. 3-day mood dots */}
      <div
        className="rounded-2xl p-3 shadow-sm border-2"
        style={{
          background: "rgba(255, 250, 230, 0.94)",
          borderColor: "rgba(160, 120, 60, 0.45)",
          color: "#2a2010",
        }}
        aria-label="Last 3 days mood"
      >
        <div
          className="text-[11px] uppercase tracking-wide font-semibold"
          style={{ color: "#7a4d12" }}
        >
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
                  <span className="text-[10px] mt-1" style={{ color: "rgba(42,32,16,0.7)" }}>
                    {d.date.slice(5)}
                  </span>
                </div>
              );
            })}
        </div>
        <div className="text-xs mt-2" style={{ color: "#3a2a00" }}>
          Last 3 days
        </div>
      </div>

      {/* 3. Resume / All caught up */}
      {next ? (
        <Link href={`/today#block-${next.id}`}>
          <div
            className="rounded-2xl p-3 shadow-sm border-2 cursor-pointer hover:brightness-105 transition"
            style={{
              background: "linear-gradient(180deg, #fff4d6 0%, #ffe5a8 100%)",
              borderColor: "#d6a544",
              color: "#3a2a00",
            }}
            aria-label="Pick up where you left off"
          >
            <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "#7a4d12" }}>
              Pick up where I left off
            </div>
            <div className="font-bold mt-0.5 truncate">{next.title || "Next block"}</div>
            <div className="text-xs capitalize" style={{ color: "rgba(58,42,0,0.75)" }}>
              {next.subjectSlug}
            </div>
            <div className="text-xs font-bold mt-1" style={{ color: "#7a4d12" }}>
              Jump →
            </div>
          </div>
        </Link>
      ) : (
        <div
          className="rounded-2xl p-3 shadow-sm border-2"
          style={{
            background: "rgba(220, 252, 231, 0.96)",
            borderColor: "#86efac",
            color: "#0f4f24",
          }}
          aria-label="All caught up"
        >
          <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "#147a3a" }}>
            Nice!
          </div>
          <div className="font-bold mt-0.5">All caught up today</div>
          <div className="text-xs mt-1" style={{ color: "rgba(15,79,36,0.8)" }}>
            No more blocks waiting.
          </div>
        </div>
      )}
    </div>
  );
}
