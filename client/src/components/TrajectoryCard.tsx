import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMemo } from "react";

/**
 * TrajectoryCard — Parent-only trajectory view.
 *
 * Goal: track Reagan's path back to grade level so the IEP can be unwound by
 * 6th grade. Surfaces:
 *   • Avg mastery level per subject (0-5)
 *   • % of skills she's at level ≥ 4 ("got it / could teach Kiwi")
 *   • Projected weeks-to-grade-level at current pace
 *   • IEP exit indicators (using thresholds the IH district uses for
 *     intervention exit: MAP RIT at/above grade norm, Acadience at benchmark)
 *
 * NEVER show this card to Reagan. It lives behind the AdultGate on Analytics.
 */
export default function TrajectoryCard() {
  const summary = trpc.skillLadder.summary.useQuery();

  const SUBJECT_META: Record<string, { label: string; color: string; emoji: string }> = {
    math:    { label: "Math",            color: "#fbbf24", emoji: "🔢" },
    ela:     { label: "Reading & Writing", color: "#60a5fa", emoji: "📖" },
    science: { label: "Science",         color: "#34d399", emoji: "🔬" },
    ss:      { label: "Social Studies",  color: "#f472b6", emoji: "🌎" },
  };

  const rows = (summary.data as any[]) || [];
  const overall = useMemo(() => {
    if (!rows.length) return null;
    const totalSkills = rows.reduce((a, r) => a + r.skills, 0);
    const totalMastered = rows.reduce((a, r) => a + r.mastered, 0);
    const avgLevel = rows.reduce((a, r) => a + r.avgLevel, 0) / rows.length;
    return {
      pctMastered: totalSkills ? Math.round((totalMastered / totalSkills) * 100) : 0,
      avgLevel: +avgLevel.toFixed(2),
      totalSkills,
      totalMastered,
    };
  }, [rows]);

  // Catch-up projection (rough): assume she masters ~3 skills/week with the
  // 15-min daily Skill Builder. Weeks to reach 80% mastery (= "exiting RIPE
  // intervention" threshold per IH district guidance).
  const targetPctMastered = 80;
  const skillsToGo = overall ? Math.max(0, Math.ceil((targetPctMastered / 100) * overall.totalSkills) - overall.totalMastered) : 0;
  const weeksToTarget = Math.ceil(skillsToGo / 3);

  // "Don't show if no info" rule — hide entire card while loading or empty.
  if (summary.isLoading) return null;
  if (rows.length === 0) return null;

  return (
    <Card className="cozy-card p-5 space-y-4 border-2 border-amber-300/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Parent-only · catch-up trajectory</div>
          <h2 className="font-display text-xl font-semibold mt-0.5">Where Reagan is — and how close to graduating the IEP</h2>
        </div>
        <span className="text-3xl" aria-hidden>🎯</span>
      </div>

      {/* Overall headline */}
      {overall && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Overall mastery</div>
              <div className="font-display text-2xl">{overall.pctMastered}% mastered <span className="text-sm text-muted-foreground font-normal">({overall.totalMastered} of {overall.totalSkills} skills)</span></div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Projected to {targetPctMastered}%</div>
              <div className="font-display text-2xl">{weeksToTarget} wk{weeksToTarget === 1 ? "" : "s"}</div>
              <div className="text-[10px] text-muted-foreground">@ ~3 skills/wk pace</div>
            </div>
          </div>
          <Progress value={overall.pctMastered} className="mt-3 h-2" />
        </div>
      )}

      {/* Per-subject */}
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.map((r: any) => {
          const meta = SUBJECT_META[r.subjectSlug] || { label: r.subjectSlug, color: "#94a3b8", emoji: "📘" };
          return (
            <div key={r.subjectSlug} className="rounded-lg border border-neutral-200/60 dark:border-white/10 p-3" style={{ borderTop: `3px solid ${meta.color}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>{meta.emoji}</span>
                  <span className="font-semibold">{meta.label}</span>
                </div>
                <div className="text-sm font-display">{r.pctMastered}%</div>
              </div>
              <Progress value={r.pctMastered} className="mt-2 h-1.5" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                <span>{r.mastered}/{r.skills} mastered</span>
                <span>avg level {r.avgLevel}/5</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* IEP exit thresholds (IH-style) */}
      <div className="rounded-md bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-white/10 p-3 text-[12px] space-y-1">
        <div className="font-semibold text-neutral-700 dark:text-neutral-200">IEP exit indicators (Indian Hill RIPE / RIMP)</div>
        <ul className="list-disc pl-5 space-y-0.5 text-neutral-600 dark:text-neutral-300">
          <li><b>Reading:</b> Acadience composite at or above benchmark for two consecutive screenings; MAZE at grade-level cut score.</li>
          <li><b>Math:</b> MAP RIT score at or above 5th-grade fall norm (~209) and growing; class-based unit assessments at 75%+.</li>
          <li><b>Curriculum-based measures:</b> 4 of 5 5th-grade Ohio standards mastered per subject (≥80% on this ladder).</li>
        </ul>
        <div className="pt-1 italic text-neutral-500">Reagan never sees this card. She only sees her own ladder going up on the My Levels page.</div>
      </div>
    </Card>
  );
}
