import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

export default function Knowledge() {
  const list = trpc.knowledge.list.useQuery({});
  const add = trpc.knowledge.add.useMutation();
  const del = trpc.knowledge.delete.useMutation();
  const utils = trpc.useUtils();
  const [insight, setInsight] = useState("");
  const [type, setType] = useState("interest");

  const TYPES = ["academic_strength", "academic_gap", "trigger", "accommodation", "interest", "social", "preference", "strategy", "quote", "medical"] as const;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">Reagan Knowledge Base 🧠</h1>
        <p className="text-muted-foreground text-sm mt-1">Insights about Reagan that Whisper uses to shape every interaction. Add anything you learn about her.</p>
      </header>

      <Card className="cozy-card p-4 space-y-3">
        <div className="font-display font-semibold">Add an insight</div>
        <Textarea placeholder="e.g. 'Reagan loves it when you let her sit on the floor while reading'" value={insight} onChange={e => setInsight(e.target.value)} />
        <div className="flex gap-2 flex-wrap">
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} className={`text-xs px-2 py-1 rounded-full border ${type === t ? "bg-primary text-primary-foreground" : "bg-card"}`}>{t}</button>
          ))}
        </div>
        <Button onClick={() => {
          if (!insight.trim()) return;
          add.mutate({ insight, insightType: type as any, source: "manual" }, { onSuccess: () => { toast.success("Whisper now knows."); setInsight(""); utils.knowledge.list.invalidate(); }});
        }}>Save to Whisper's brain</Button>
      </Card>

      <Card className="cozy-card p-4 bg-amber-50/40 border-amber-200">
        <div className="font-display font-semibold mb-2">📥 Auto-Sync Sources (coming soon)</div>
        <p className="text-sm text-muted-foreground">Gmail (teachers, therapist, school) and Google Drive (assessments, reports, journals) can be auto-scanned for Reagan-relevant insights once you authorize the connections from your account.</p>
        <Button disabled variant="outline" className="mt-3 bg-card">Connect Gmail (needs OAuth)</Button>
      </Card>

      <div className="space-y-2">
        <div className="font-display font-semibold">All insights ({list.data?.length ?? 0})</div>
        {(list.data ?? []).map((k: any) => (
          <Card key={k.id} className="cozy-card p-3">
            <div className="flex items-start gap-2">
              <Badge variant="secondary" className="text-[10px]">{k.insightType}</Badge>
              <div className="flex-1 text-sm">{k.insight}</div>
              <button onClick={() => del.mutate({ id: k.id }, { onSuccess: () => utils.knowledge.list.invalidate() })} className="text-xs text-muted-foreground hover:text-rose-500">remove</button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">{k.source} · {new Date(k.createdAt).toLocaleDateString()}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
