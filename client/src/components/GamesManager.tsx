import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * GamesManager — parent-side editor for the games & break choices Reagan can
 * pick from on the GameBreakCard. Lives inside Settings.
 */
export default function GamesManager() {
  const list = trpc.games.list.useQuery({ activeOnly: false });
  const utils = trpc.useUtils();
  const upsert = trpc.games.upsert.useMutation({
    onSuccess: () => { utils.games.list.invalidate(); toast.success("Saved"); },
  });
  const deactivate = trpc.games.deactivate.useMutation({
    onSuccess: () => { utils.games.list.invalidate(); toast("Hidden from Reagan"); },
  });

  const [form, setForm] = useState({
    title: "", emoji: "🎮", kind: "app" as "web" | "app" | "console" | "offline",
    preferredMinutes: 10, rank: 100, notes: "",
  });

  function add() {
    if (!form.title.trim()) return;
    upsert.mutate({ ...form, notes: form.notes || null } as any);
    setForm({ title: "", emoji: "🎮", kind: "app", preferredMinutes: 10, rank: 100, notes: "" });
  }

  return (
    <Card className="classroom-card p-5 space-y-3">
      <div>
        <div className="font-display font-semibold text-lg">Games & Break Choices</div>
        <div className="text-xs text-muted-foreground">
          What Kiwi offers when Reagan signals frustration (2+ "Hard" in 30 min) or earns a reward (2+ "Got it!").
          Keep the list short and Reagan-approved.
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Emoji</label>
          <input className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900 w-14"
            value={form.emoji} maxLength={4}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
        </div>
        <div className="flex flex-col flex-1 min-w-[140px]">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Title</label>
          <input className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900"
            placeholder="e.g. Adopt Me!"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="flex flex-col">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Kind</label>
          <select className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900"
            value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })}>
            <option value="app">App</option>
            <option value="web">Web</option>
            <option value="console">Console</option>
            <option value="offline">Offline</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Mins</label>
          <input type="number" className="text-sm border border-border rounded px-2 py-1 bg-white text-neutral-900 w-20"
            value={form.preferredMinutes}
            onChange={(e) => setForm({ ...form, preferredMinutes: Number(e.target.value) || 10 })} />
        </div>
        <Button onClick={add} disabled={upsert.isPending} size="sm">+ Add</Button>
      </div>

      <div className="space-y-2 pt-1">
        {(list.data ?? []).map((g: any) => (
          <div key={g.id} className="flex items-center justify-between gap-2 p-2 rounded border bg-neutral-50">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg" aria-hidden>{g.emoji}</span>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate text-neutral-900">{g.title}</div>
                <div className="text-[11px] text-neutral-500">
                  {g.kind} · {g.preferredMinutes} min {g.active ? "" : " · hidden"}
                </div>
              </div>
            </div>
            {g.active && (
              <Button size="sm" variant="outline" className="bg-white text-xs h-7"
                onClick={() => deactivate.mutate({ id: g.id })}>
                Hide
              </Button>
            )}
          </div>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="text-xs text-muted-foreground italic">No games yet. Add Reagan's go-to options above.</div>
        )}
      </div>
    </Card>
  );
}
