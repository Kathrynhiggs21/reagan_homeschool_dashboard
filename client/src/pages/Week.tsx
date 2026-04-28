import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdultLock } from "@/contexts/AdultLockContext";
import BlockEditor from "@/components/BlockEditor";
import { toast } from "sonner";

function startOfWeek(d: Date) {
  const out = new Date(d);
  const day = out.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day; // make Monday-start
  out.setDate(out.getDate() + diff);
  out.setHours(0,0,0,0);
  return out;
}

function DayCard({ date, label, isToday }: { date: string; label: string; isToday: boolean }) {
  const { unlocked } = useAdultLock();
  const utils = trpc.useUtils();
  const ensure = trpc.plans.byDate.useQuery({ date });
  const plan: any = ensure.data;
  const blocksQ = trpc.blocks.list.useQuery({ planId: plan?.id || 0 }, { enabled: !!plan?.id });
  const blocks: any[] = blocksQ.data || [];
  const del = trpc.blocks.delete.useMutation({ onSuccess: () => utils.blocks.list.invalidate({ planId: plan?.id }) });
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const done = blocks.filter(b => b.status === "complete").length;
  const total = blocks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Card className={`classroom-card p-4 min-h-[220px] ${isToday ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="font-display font-semibold text-sm">{label}</div>
        {isToday && <Badge className="text-[10px]">Today</Badge>}
      </div>
      {plan ? (
        <>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{plan.dayType}</div>
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">{done}/{total} blocks done</div>
          <ul className="mt-3 space-y-1">
            {blocks.slice(0, unlocked ? 20 : 5).map((b: any) => (
              <li key={b.id} className="text-xs flex items-start gap-1.5 group">
                <span className="mt-0.5">{b.status === "complete" ? "✓" : "•"}</span>
                <span className={`flex-1 ${b.status === "complete" ? "line-through text-muted-foreground" : ""}`}>{b.title}</span>
                {unlocked && (
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      className="text-[10px] hover:underline"
                      onClick={() => setEditing(b)}
                      aria-label="Edit block"
                    >✎</button>
                    <button
                      className="text-[10px] hover:underline text-destructive"
                      onClick={async () => { if (confirm(`Delete "${b.title}"?`)) { await del.mutateAsync({ id: b.id }); toast.success("Block deleted"); } }}
                      aria-label="Delete block"
                    >🗑</button>
                  </span>
                )}
              </li>
            ))}
            {!unlocked && blocks.length > 5 && (
              <li className="text-[10px] text-muted-foreground italic">+{blocks.length - 5} more…</li>
            )}
          </ul>
          {unlocked && plan?.id && (
            <Button size="sm" variant="outline" className="bg-transparent mt-3 w-full text-xs" onClick={() => setAdding(true)}>
              + Add block
            </Button>
          )}
          {editing && (
            <BlockEditor
              open={!!editing}
              onOpenChange={(o) => !o && setEditing(null)}
              block={editing}
              planId={plan.id}
              onSaved={() => { setEditing(null); utils.blocks.list.invalidate({ planId: plan.id }); }}
            />
          )}
          {adding && (
            <BlockEditor
              open={adding}
              onOpenChange={(o) => !o && setAdding(false)}
              planId={plan.id}
              onSaved={() => { setAdding(false); utils.blocks.list.invalidate({ planId: plan.id }); }}
            />
          )}
        </>
      ) : (
        <div className="text-xs text-muted-foreground mt-3 italic">Plan opens that morning.</div>
      )}
    </Card>
  );
}

export default function Week() {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = useMemo(() => new Date(), []);
  const baseMonday = useMemo(() => {
    const m = startOfWeek(today);
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [today, weekOffset]);

  const days = useMemo(() => {
    const out: { date: string; label: string; isToday: boolean }[] = [];
    const todayIso = today.toISOString().slice(0, 10);
    for (let i = 0; i < 5; i++) { // Mon-Fri
      const d = new Date(baseMonday); d.setDate(baseMonday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        date: iso,
        label: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
        isToday: iso === todayIso,
      });
    }
    return out;
  }, [baseMonday, today]);

  const upcoming = trpc.specialDays.upcoming.useQuery({ limit: 8 });

  const weekLabel = (() => {
    const end = new Date(baseMonday); end.setDate(baseMonday.getDate() + 4);
    return `${baseMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  })();

  return (
    <div className="space-y-6">
      <header className="chalkboard flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl md:text-5xl leading-none">
            <span className="chalk-pink">This</span>{" "}
            <span className="chalk-yellow">Week</span>
          </h1>
          <p className="font-display text-base chalk-white opacity-85 mt-2">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(o => o - 1)}>← Prev</Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>This Week</Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(o => o + 1)}>Next →</Button>
        </div>
      </header>

      {upcoming.data && upcoming.data.length > 0 && (
        <Card className="classroom-card p-4">
          <div className="text-sm font-semibold mb-2 chalk-white">Coming Up</div>
          <div className="flex flex-wrap gap-2">
            {upcoming.data.slice(0, 6).map((d: any) => (
              <div key={d.id} className="mood-chip text-xs">
                <span>{d.emoji || "📌"}</span>
                <span>{d.name}</span>
                <span className="text-muted-foreground">{new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {days.map(d => (
          <DayCard key={d.date} date={d.date} label={d.label} isToday={d.isToday} />
        ))}
      </div>
    </div>
  );
}
