/**
 * Academics — adult-only Academic Record browser + paste-to-file flow.
 * Paste a Classroom invite, PowerSchool line, Gmail forward, IXL URL, etc.
 * The LLM extracts {kind, title, subject, summary, score, due date} and
 * files the record. All records are searchable + filterable.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const SOURCES = [
  { v: "paste", label: "Manual paste" },
  { v: "manus_share", label: "Manus share" },
  { v: "gmail", label: "Gmail" },
  { v: "classroom", label: "Google Classroom" },
  { v: "powerschool_ih", label: "PowerSchool · IH" },
  { v: "powerschool_madeira", label: "PowerSchool · Madeira" },
  { v: "ixl", label: "IXL" },
  { v: "drive", label: "Google Drive" },
  { v: "manual", label: "Hand-entered" },
] as const;

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Academics() {
  const list = trpc.academics.list.useQuery({});
  const createM = trpc.academics.create.useMutation();
  const extractM = trpc.academics.extract.useMutation();
  const deleteM = trpc.academics.delete.useMutation();
  const utils = trpc.useUtils();

  const [raw, setRaw] = useState("");
  const [source, setSource] = useState<string>("paste");
  const [draft, setDraft] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  const rows = useMemo(() => (list.data as any[] | undefined) ?? [], [list.data]);
  const filtered = useMemo(() => {
    const qq = q.toLowerCase();
    return rows.filter((r) => {
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (!qq) return true;
      return [r.title, r.summary, r.subjectSlug, r.scoreText].filter(Boolean).some((v: string) => v.toLowerCase().includes(qq));
    });
  }, [rows, q, sourceFilter]);

  async function extract() {
    if (!raw.trim()) { toast.error("Paste something first."); return; }
    const d = await extractM.mutateAsync({ source: source as any, text: raw });
    setDraft({
      source,
      kind: d?.kind || "note",
      title: d?.title || "",
      subjectSlug: d?.subjectSlug || "",
      summary: d?.summary || "",
      scoreText: d?.scoreText || "",
      scorePercent: typeof d?.scorePercent === "number" ? d.scorePercent : undefined,
      dueAt: d?.dueAt ? new Date(d.dueAt as any).toISOString().slice(0, 10) : "",
      payload: raw,
    });
    toast.success("Draft ready. Review and save.");
  }

  async function save() {
    if (!draft) return;
    await createM.mutateAsync({
      source: draft.source,
      kind: draft.kind,
      subjectSlug: draft.subjectSlug || undefined,
      title: draft.title,
      summary: draft.summary || undefined,
      scoreText: draft.scoreText || undefined,
      scorePercent: draft.scorePercent,
      dueAt: draft.dueAt || undefined,
      payload: draft.payload,
    } as any);
    utils.academics.list.invalidate();
    setDraft(null); setRaw("");
    toast.success("Filed.");
  }

  async function del(id: number) {
    if (!confirm("Remove this record?")) return;
    await deleteM.mutateAsync({ id });
    utils.academics.list.invalidate();
    toast.success("Removed.");
  }

  return (
    <div className="space-y-4">
      <header className="chalkboard">
        <div className="font-chalk-hand text-xl chalk-yellow">Adult · Academic Record</div>
        <h1 className="font-display text-3xl md:text-4xl mt-1 chalk-white">Academics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a Classroom invite, PowerSchool line, Gmail forward, IXL URL, or any update. The dashboard extracts and files it.
        </p>
      </header>

      <Card className="classroom-card p-4 space-y-3">
        <div className="flex gap-2 items-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Source:</div>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          placeholder="Paste anything — an email, Classroom invite, gradebook row, IXL URL, Drive link with context, a PowerSchool screenshot caption…"
        />
        <div className="flex gap-2">
          <Button onClick={extract} disabled={extractM.isPending}>
            {extractM.isPending ? "Reading…" : "Extract"}
          </Button>
          {draft && <Button variant="outline" className="bg-transparent" onClick={() => setDraft(null)}>Discard draft</Button>}
        </div>

        {draft && (
          <Card className="p-3 bg-white/40 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Draft — edit, then file</div>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <Input placeholder="Subject slug (math/ela/science/ss/…)" value={draft.subjectSlug || ""} onChange={(e) => setDraft({ ...draft, subjectSlug: e.target.value })} />
              <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["assignment","grade","mastery","note","attendance"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Due date (YYYY-MM-DD)" value={draft.dueAt || ""} onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })} />
              <Input placeholder="Score text (e.g. 18/20, A-)" value={draft.scoreText || ""} onChange={(e) => setDraft({ ...draft, scoreText: e.target.value })} />
              <Input placeholder="Score %" type="number" value={draft.scorePercent ?? ""} onChange={(e) => setDraft({ ...draft, scorePercent: e.target.value === "" ? undefined : Number(e.target.value) })} />
            </div>
            <Textarea rows={3} value={draft.summary || ""} placeholder="Summary" onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
            <div className="flex gap-2">
              <Button onClick={save} disabled={createM.isPending}>File record</Button>
            </div>
          </Card>
        )}
      </Card>

      <Card className="classroom-card p-4 space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <Input placeholder="Search records…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 min-w-[200px]" />
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCES.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">{filtered.length} / {rows.length}</div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground italic p-3">No records yet. Paste something above to start a record.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <Card key={r.id} className="p-3 bg-white/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{r.source}</Badge>
                      <Badge variant="outline" className="text-[10px]">{r.kind}</Badge>
                      {r.subjectSlug && <Badge variant="outline" className="text-[10px] capitalize">{r.subjectSlug}</Badge>}
                      <span className="text-[11px] text-muted-foreground">{fmt(r.createdAt)}</span>
                    </div>
                    <div className="font-semibold mt-1">{r.title}</div>
                    {r.summary && <div className="text-sm text-muted-foreground">{r.summary}</div>}
                    {(r.scoreText || r.scorePercent != null) && (
                      <div className="text-sm mt-1">Score: <strong>{r.scoreText ?? `${r.scorePercent}%`}</strong></div>
                    )}
                    {r.dueAt && <div className="text-xs text-muted-foreground">Due: {fmt(r.dueAt)}</div>}
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(r.id)}>Remove</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
