import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function Analytics() {
  const overview = trpc.analytics.wellness.useQuery({});
  const skills = trpc.skills.list.useQuery();
  const struggles = trpc.struggles.list.useQuery({});

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">Analytics 📊</h1>
        <p className="text-muted-foreground text-sm mt-1">For adults — Reagan's growth, patterns, and where she needs support.</p>
      </header>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="cozy-card p-4">
          <div className="text-xs text-muted-foreground">Blocks completed (14d)</div>
          <div className="text-3xl font-display font-semibold mt-1">{(overview.data as any)?.blocksCompleted ?? 0}</div>
        </Card>
        <Card className="cozy-card p-4">
          <div className="text-xs text-muted-foreground">Green days (14d)</div>
          <div className="text-3xl font-display font-semibold mt-1 text-emerald-600">{(overview.data as any)?.greenDays ?? 0}</div>
        </Card>
        <Card className="cozy-card p-4">
          <div className="text-xs text-muted-foreground">Yellow / Red days</div>
          <div className="text-3xl font-display font-semibold mt-1">{((overview.data as any)?.yellowDays ?? 0) + ((overview.data as any)?.redDays ?? 0)}</div>
        </Card>
      </div>

      <Card className="cozy-card p-4">
        <h2 className="font-display font-semibold mb-3">Skills Mastery</h2>
        <div className="space-y-2">
          {skills.data?.map((sk: any) => (
            <div key={sk.id}>
              <div className="flex justify-between text-sm">
                <span>{sk.skillName} <span className="text-xs text-muted-foreground">({sk.subjectSlug})</span></span>
                <span className="font-mono text-xs">{sk.currentScore || 0}%</span>
              </div>
              <Progress value={sk.currentScore || 0} className="h-2 mt-1" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="cozy-card p-4">
        <h2 className="font-display font-semibold mb-3">Recent Emotional Struggles</h2>
        <div className="space-y-2">
          {(struggles.data ?? []).slice(0, 10).map((s: any) => (
            <div key={s.id} className="text-sm flex items-start gap-2 p-2 rounded-lg bg-muted/30">
              <span className={`w-2 h-2 rounded-full mt-2 ${s.intensity === "red" ? "bg-rose-500" : s.intensity === "yellow" ? "bg-amber-400" : "bg-emerald-400"}`}/>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">{new Date(s.loggedAt).toLocaleDateString()} · {s.subjectSlug || "general"}</div>
                {s.description && <div>{s.description}</div>}
              </div>
            </div>
          ))}
          {struggles.data?.length === 0 && <div className="text-sm text-muted-foreground italic">No struggles logged. ✨</div>}
        </div>
      </Card>
    </div>
  );
}
