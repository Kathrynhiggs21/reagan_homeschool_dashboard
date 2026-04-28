import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

function PasteIngestCard() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const ingest = trpc.knowledge.ingestText.useMutation();
  const utils = trpc.useUtils();
  return (
    <Card className="cozy-card p-4 space-y-3 bg-rose-50/30 border-rose-200">
      <div className="font-display font-semibold">📝 Paste an email, doc, or evaluation</div>
      <p className="text-xs text-muted-foreground">Kiwi reads it and extracts only the Reagan-specific insights. Nothing leaves the dashboard.</p>
      <input className="w-full px-3 py-2 rounded-lg border bg-card text-sm" placeholder="Source title (e.g. 'Mrs. Marlow email Apr 22')" value={title} onChange={e => setTitle(e.target.value)} />
      <Textarea rows={6} placeholder="Paste raw email body, doc text, or notes here..." value={text} onChange={e => setText(e.target.value)} />
      <Button disabled={ingest.isPending || !text.trim() || !title.trim()} onClick={() => {
        ingest.mutate({ sourceTitle: title.trim(), rawText: text.trim(), source: "manual" }, {
          onSuccess: (r: any) => {
            toast.success(`Kiwi extracted ${r.inserted} insights.`);
            setTitle(""); setText("");
            utils.knowledge.list.invalidate();
          },
          onError: (e: any) => toast.error(e.message || "Could not extract insights"),
        });
      }}>{ingest.isPending ? "Reading..." : "Extract insights with Kiwi"}</Button>
    </Card>
  );
}

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
        <p className="text-muted-foreground text-sm mt-1">Insights about Reagan that Kiwi uses to shape every interaction. Add anything you learn about her.</p>
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
          add.mutate({ insight, insightType: type as any, source: "manual" }, { onSuccess: () => { toast.success("Kiwi now knows."); setInsight(""); utils.knowledge.list.invalidate(); }});
        }}>Save to Kiwi's brain</Button>
      </Card>

      <PasteIngestCard />

      <Card className="cozy-card p-4 bg-amber-50/40 border-amber-200">
        <div className="font-display font-semibold mb-2">📥 Auto-Sync Sources</div>
        <p className="text-sm text-muted-foreground">Gmail and Google Drive auto-scan can be wired in via a future MCP authorization. For now, paste any email or document above and Kiwi will extract the structured insights for you.</p>
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
