/**
 * TodayCoveredRecapCard
 *
 * Kid-facing celebration widget. Mirror to TodayMomVoiceMemoCard, but:
 *   - protectedProcedure (any signed-in user can read)
 *   - server returns ONLY {id, subject, code, title} for done rows
 *   - no notes / source / timestamp ever leak to the kid client
 *   - no in-progress nags — just the wins
 *
 * Mounts unconditionally on Today (NOT inside `{unlocked && ...}`). The
 * server-side redaction is the security boundary; the client just renders.
 *
 * Hide-when-empty: returns `null` when nothing is covered yet, so the kid
 * pane stays clean before the first ingest.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

type Row = {
  id: number;
  subject: string;
  code: string;
  title: string;
};

const SUBJECT_EMOJI: Record<string, string> = {
  Math: "🔢",
  ELA: "📖",
  Science: "🔬",
  Specials: "🎨",
  History: "🌍",
  "Social Studies": "🌍",
};

export default function TodayCoveredRecapCard() {
  const q = trpc.curriculum.kidCoveredFromVoiceMemos.useQuery(
    { limit: 60 },
    {
      staleTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  const rows = (q.data ?? []) as Row[];
  if (q.isLoading) return null;
  if (rows.length === 0) return null;

  const bySubject = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.subject || "Other";
    const arr = bySubject.get(k) || [];
    arr.push(r);
    bySubject.set(k, arr);
  }
  const subjects = Array.from(bySubject.keys()).sort();

  return (
    <Card
      className="classroom-card p-4"
      data-testid="today-covered-recap-card"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-display text-lg font-semibold chalk-white">
          Look what you've already done!
        </h2>
        <Badge
          variant="outline"
          className="text-[11px] font-semibold border-emerald-500/40 text-emerald-300"
        >
          {rows.length} topics
        </Badge>
      </div>

      <div className="space-y-3">
        {subjects.map((subj) => {
          const items = bySubject.get(subj) || [];
          const emoji = SUBJECT_EMOJI[subj] ?? "✨";
          return (
            <div
              key={subj}
              data-testid={`today-covered-recap-subject-${subj}`}
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                <span className="mr-1.5">{emoji}</span>
                {subj} · {items.length}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((r) => (
                  <Badge
                    key={r.id}
                    variant="outline"
                    className="text-[11px] font-medium bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                    title={`${r.code} — ${r.title}`}
                    data-testid={`today-covered-recap-item-${r.id}`}
                  >
                    {r.title}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
