import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { TrendingUp, ChevronRight } from "lucide-react";

function TrafficLight({ light }: { light: string }) {
  if (light === "green") return <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 ring-1 ring-emerald-300/40" title="Strong" />;
  if (light === "amber") return <span className="inline-block w-3 h-3 rounded-full bg-amber-400 ring-1 ring-amber-300/40" title="Developing" />;
  return <span className="inline-block w-3 h-3 rounded-full bg-rose-400 ring-1 ring-rose-300/40" title="Needs work" />;
}

export default function CatchupEngineCard() {
  const q = trpc.skillLadder.catchupEngine.useQuery(undefined, { staleTime: 120_000 });

  if (q.isLoading) {
    return (
      <Card className="p-4 space-y-3 animate-pulse">
        <div className="h-4 w-40 bg-muted rounded" />
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded" />)}
      </Card>
    );
  }

  const subjects: any[] = q.data ?? [];
  if (subjects.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">No skill ladder data yet. Add skills in the Curriculum Hub to track mastery.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-900/30 to-indigo-900/20 border-b border-border/40">
        <TrendingUp className="w-4 h-4 text-violet-400" />
        <h3 className="font-semibold text-sm">Catch-up Engine</h3>
        <span className="ml-auto text-xs text-muted-foreground">weakest first</span>
      </div>

      <div className="divide-y divide-border/30">
        {subjects.map((s) => (
          <div key={s.subjectSlug} className="px-4 py-3 space-y-2">
            {/* Subject row */}
            <div className="flex items-center gap-2">
              <TrafficLight light={s.trafficLight} />
              <span className="font-medium text-sm">{s.label}</span>
              <div className="flex-1 mx-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    s.trafficLight === "green" ? "bg-emerald-400" :
                    s.trafficLight === "amber" ? "bg-amber-400" : "bg-rose-400"
                  }`}
                  style={{ width: `${s.pctMastered}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                {s.pctMastered}% · {s.mastered}/{s.skills}
              </span>
            </div>

            {/* Next-3 topics */}
            {s.nextTopics && s.nextTopics.length > 0 && (
              <div className="ml-5 space-y-0.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Next up</p>
                {s.nextTopics.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    <span className="truncate">{t.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] tabular-nums">
                      lvl {t.level}/4
                    </span>
                  </div>
                ))}
              </div>
            )}

            {s.nextTopics && s.nextTopics.length === 0 && s.trafficLight === "green" && (
              <p className="ml-5 text-[11px] text-emerald-400/80">All skills mastered ✓</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
