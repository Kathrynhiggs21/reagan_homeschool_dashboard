import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

export default function RescueJournal() {
  const list = trpc.rescues.list.useQuery();
  const add = trpc.rescues.add.useMutation();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nickname: "", species: "", foundLocation: "", condition: "", carePlan: "" });

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-display font-semibold">Rescue Journal 💛</h1>
          <p className="text-muted-foreground text-sm mt-1">Every animal you've helped. Every life that's better because of you.</p>
        </div>
        <Button onClick={() => setOpen(o => !o)}>+ New Rescue</Button>
      </header>

      {open && (
        <Card className="cozy-card p-4 space-y-3">
          <Input placeholder="Nickname (e.g. 'Little Hawk')" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} />
          <Input placeholder="Species" value={form.species} onChange={e => setForm({ ...form, species: e.target.value })} />
          <Input placeholder="Where found" value={form.foundLocation} onChange={e => setForm({ ...form, foundLocation: e.target.value })} />
          <Textarea placeholder="Condition when found" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} />
          <Textarea placeholder="Care plan" value={form.carePlan} onChange={e => setForm({ ...form, carePlan: e.target.value })} />
          <Button onClick={() => {
            add.mutate({ ...form, dateFound: new Date().toISOString().slice(0,10) }, { onSuccess: () => { toast.success("Logged. You're a real one. 🪶"); setOpen(false); setForm({ nickname: "", species: "", foundLocation: "", condition: "", carePlan: "" }); utils.rescues.list.invalidate(); }});
          }}>Save Rescue Report</Button>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {(list.data ?? []).map((r: any) => (
          <Card key={r.id} className="cozy-card p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display font-semibold">{r.nickname || "Unnamed"}</h3>
              <span className="text-xs text-muted-foreground">{r.outcome || "ongoing"}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{r.species}</div>
            {r.condition && <p className="text-sm mt-2">{r.condition}</p>}
            {r.carePlan && <p className="text-xs text-muted-foreground mt-1 italic">Plan: {r.carePlan}</p>}
          </Card>
        ))}
        {list.data?.length === 0 && (
          <Card className="cozy-card p-6 text-center text-muted-foreground sm:col-span-2">
            <div className="text-4xl mb-2">🪶</div>
            <p className="font-hand text-lg">No rescues logged yet. When you help your next critter, log it here.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
