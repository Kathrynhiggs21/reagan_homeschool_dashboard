import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";

export default function Week() {
  const plans = trpc.plans.list.useQuery();
  const upcoming = trpc.specialDays.upcoming.useQuery({ limit: 7 });

  const days = (() => {
    const out: { date: string; label: string; plan?: any }[] = [];
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - today.getDay() + 1);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const plan = plans.data?.find((p: any) => p.date === iso);
      out.push({ date: iso, label, plan });
    }
    return out;
  })();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">This Week</h1>
        <p className="text-muted-foreground text-sm mt-1">Gentle look at the week ahead — no pressure.</p>
      </header>

      {upcoming.data && upcoming.data.length > 0 && (
        <Card className="cozy-card p-4 bg-gradient-to-r from-amber-50 to-rose-50 border-amber-200">
          <div className="text-sm font-semibold mb-2">✨ Wonder Days Coming Up</div>
          <div className="space-y-1">
            {upcoming.data.slice(0, 5).map((d: any) => (
              <div key={d.id} className="text-sm flex items-center gap-2">
                <span className="text-lg">{d.emoji || "🌟"}</span>
                <span className="font-medium">{d.name}</span>
                <span className="text-muted-foreground text-xs">— {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {days.map(d => (
          <Card key={d.date} className="cozy-card p-4 min-h-[120px]">
            <div className="font-display font-semibold text-sm">{d.label}</div>
            {d.plan ? (
              <div className="text-xs text-muted-foreground mt-2">{d.plan.dayType} day</div>
            ) : (
              <div className="text-xs text-muted-foreground mt-2 italic">No plan yet</div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
