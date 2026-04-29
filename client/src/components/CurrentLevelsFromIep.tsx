import { useMemo } from "react";
import { Card } from "@/components/ui/card";

/**
 * Current Levels (from IEP) card
 * --------------------------------
 * Mom asked: "Can IEP info update the analytics right now about what level Reagan's at?"
 * Answer: yes — this card takes the present-level text on each IEP goal + the
 * most-recent screening row per measure, groups by subject, and shows a glanceable
 * chip strip so she can see "Reading: 87 wcpm/26th %ile · MAZE 7/7th %ile" without
 * having to scroll through every goal card.
 */

type IepGoal = {
  id: number;
  subjectSlug?: string | null;
  area?: string | null;
  goalText?: string | null;
  presentLevel?: string | null;
};

type Screening = {
  id: number;
  subjectSlug?: string | null;
  measure?: string | null;
  score?: string | number | null;
  percentile?: number | null;
  reportDate?: string | null;
  assessedOn?: string | null;
};

const SUBJECT_LABELS: Record<string, string> = {
  ela: "Reading & Writing (ELA)",
  reading: "Reading",
  math: "Math",
  science: "Science",
  ss: "Social Studies",
  social_studies: "Social Studies",
  other: "Self-advocacy / Social",
};

// Extract the most recent quantitative signal from free-text present-level notes.
// Looks for patterns like "Winter 24: 87 wcpm/26th %ile" or "7 / 7th percentile".
function extractHeadline(goal: IepGoal): string {
  const s = String(goal.presentLevel || "").trim();
  if (!s) return goal.goalText ? `Working on: ${goal.goalText}` : "No present-level recorded";
  // Prefer the last "season year:" segment if present.
  const seasons = s.match(/(Spring|Summer|Fall|Winter)\s+\d{2,4}[^.]*?[\.;]/gi);
  if (seasons && seasons.length > 0) {
    return seasons[seasons.length - 1].replace(/[\.;]$/, "").trim();
  }
  // Otherwise first sentence / first 180 chars
  const first = s.split(/[\.;]/)[0];
  return first.length > 180 ? first.slice(0, 180) + "…" : first;
}

export default function CurrentLevelsFromIep({
  goals,
  screenings,
}: {
  goals: IepGoal[];
  screenings: Screening[];
}) {
  // Group goals by subject. For each subject, pick up to 3 goals to show headlines for.
  const grouped = useMemo(() => {
    const map = new Map<string, { goals: IepGoal[]; latestScreenings: Screening[] }>();
    for (const g of goals || []) {
      const slug = String(g.subjectSlug || g.area || "other").toLowerCase();
      if (!map.has(slug)) map.set(slug, { goals: [], latestScreenings: [] });
      map.get(slug)!.goals.push(g);
    }
    // Per subject, grab the 2 most-recent screening rows
    for (const s of screenings || []) {
      const slug = String(s.subjectSlug || "other").toLowerCase();
      if (!map.has(slug)) map.set(slug, { goals: [], latestScreenings: [] });
      map.get(slug)!.latestScreenings.push(s);
    }
    map.forEach((v) => {
      v.latestScreenings.sort((a: Screening, b: Screening) => {
        const da = new Date(a.reportDate || a.assessedOn || 0).getTime();
        const db = new Date(b.reportDate || b.assessedOn || 0).getTime();
        return db - da;
      });
      v.latestScreenings = v.latestScreenings.slice(0, 2);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [goals, screenings]);

  if (grouped.length === 0) {
    return null;
  }

  return (
    <Card
      className="cozy-card p-4 border-l-4"
      style={{ borderLeftColor: "oklch(0.78 0.14 260)" }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-display font-semibold text-lg">
            Where Reagan is right now
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Computed live from IEP present-levels + latest screening scores. Parent-only view.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {grouped.map(([slug, { goals: gs, latestScreenings }]) => (
          <div
            key={slug}
            className="rounded-lg border p-3 bg-background/40"
          >
            <div className="flex items-baseline justify-between mb-2">
              <div className="font-semibold">
                {SUBJECT_LABELS[slug] || slug.replace(/_/g, " ")}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {gs.length} goal{gs.length === 1 ? "" : "s"}
              </div>
            </div>

            {latestScreenings.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {latestScreenings.map((s) => (
                  <span
                    key={s.id}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-foreground/10"
                    title={s.reportDate || s.assessedOn || ""}
                  >
                    {s.measure}: {String(s.score ?? "—")}
                    {s.percentile != null ? ` · ${s.percentile}%ile` : ""}
                  </span>
                ))}
              </div>
            )}

            <ul className="space-y-1.5">
              {gs.slice(0, 3).map((g) => (
                <li key={g.id} className="text-xs leading-snug">
                  <span className="text-muted-foreground">•</span>{" "}
                  {extractHeadline(g)}
                </li>
              ))}
              {gs.length > 3 && (
                <li className="text-[11px] text-muted-foreground italic">
                  +{gs.length - 3} more in the IEP goals card below
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
