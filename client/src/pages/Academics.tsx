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
import { parseAcademicsCsv, type ParsedAcademicRow } from "@/lib/parseAcademicsCsv";

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
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [termFilter, setTermFilter] = useState<string>("all");
  const [view, setView] = useState<"flat" | "timeline">("flat");
  const list = trpc.academics.list.useQuery({
    schoolYear: yearFilter === "all" ? undefined : yearFilter,
    term: termFilter === "all" ? undefined : termFilter,
  });
  const createM = trpc.academics.create.useMutation();
  const extractM = trpc.academics.extract.useMutation();
  const deleteM = trpc.academics.delete.useMutation();
  const bulkM = trpc.academics.bulkUpsert.useMutation();
  const utils = trpc.useUtils();

  // CSV uploader state
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<ParsedAcademicRow[] | null>(null);

  function previewCsv() {
    const rows = parseAcademicsCsv(csvText);
    if (rows.length === 0) { toast.error("No rows found. Need a header row + at least one data row."); return; }
    setCsvPreview(rows);
  }

  async function importCsv() {
    if (!csvPreview || csvPreview.length === 0) return;
    const r = await bulkM.mutateAsync({ records: csvPreview as any });
    toast.success(`Imported ${r.inserted} new \u00b7 ${r.skipped} skipped (duplicates)`);
    await utils.academics.list.invalidate();
    setCsvText("");
    setCsvPreview(null);
  }

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
      return [r.title, r.summary, r.subjectSlug, r.scoreText, r.teacher, r.courseName].filter(Boolean).some((v: string) => v.toLowerCase().includes(qq));
    });
  }, [rows, q, sourceFilter]);

  /** All distinct schoolYear values present in DB rows (use unfiltered list). */
  const years = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.schoolYear) s.add(r.schoolYear);
    return Array.from(s).sort().reverse();
  }, [rows]);

  /** Group filtered rows by schoolYear → courseName → term. */
  const grouped = useMemo(() => {
    const out: Record<string, Record<string, Record<string, any[]>>> = {};
    for (const r of filtered) {
      const yr = r.schoolYear || "Unfiled";
      const course = r.courseName || (r.subjectSlug ? `(${r.subjectSlug})` : "(unsorted)");
      const term = r.term || "—";
      out[yr] ??= {};
      out[yr][course] ??= {};
      out[yr][course][term] ??= [];
      out[yr][course][term].push(r);
    }
    return out;
  }, [filtered]);
  const groupedYears = Object.keys(grouped).sort().reverse();

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
      grade: "",
      schoolYear: "",
      term: "",
      teacher: "",
      courseName: "",
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
      grade: draft.grade || undefined,
      schoolYear: draft.schoolYear || undefined,
      term: draft.term || undefined,
      teacher: draft.teacher || undefined,
      courseName: draft.courseName || undefined,
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

      <details className="classroom-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">✨ Auto-ingest from Gmail / Classroom / PowerSchool / IXL (advanced)</summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <p>
            This dashboard cannot reach your Gmail / Classroom / PowerSchool / IXL accounts directly while it is hosted.
            Set up a Manus <strong>Scheduled Task</strong> with access to those connectors. In its prompt tell it to scan your inbox / classroom / IXL each morning and POST a JSON record to this site:
          </p>
          <pre className="text-[11px] bg-neutral-900 text-neutral-100 p-3 rounded overflow-auto">{`curl -X POST "$SCHEDULED_TASK_ENDPOINT_BASE/api/trpc/academics.create" \\
  -H "Content-Type: application/json" \\
  -H "Cookie: app_session_id=$SCHEDULED_TASK_COOKIE" \\
  --data '{"json": {
    "source": "powerschool_ih",
    "kind": "grade",
    "subjectSlug": "math",
    "title": "Unit 4 Quiz",
    "summary": "Reagan scored 88% on Unit 4 quiz.",
    "scoreText": "22/25",
    "scorePercent": 88
  }}'`}</pre>
          <p className="text-xs">Until then, just paste below — the LLM will extract structured fields automatically.</p>
        </div>
      </details>

      <Card className="classroom-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">CSV import</h2>
            <p className="text-xs text-muted-foreground">Paste a PowerSchool / Canvas / Classroom gradebook export. Re-running is safe — dupes are skipped.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="bg-transparent" onClick={previewCsv} disabled={!csvText.trim()}>Preview</Button>
            <Button size="sm" onClick={importCsv} disabled={!csvPreview || bulkM.isPending}>
              {bulkM.isPending ? "Importing…" : csvPreview ? `Import ${csvPreview.length}` : "Import"}
            </Button>
          </div>
        </div>
        <Textarea value={csvText} onChange={(e) => { setCsvText(e.target.value); setCsvPreview(null); }} rows={4}
          placeholder={"title,course,term,year,letter,percent,notes\nQuiz 3,Math 4,Q2,2024-25,A,93,She did great"} />
        {csvPreview && (
          <div className="text-xs bg-white/40 rounded-md border p-2 space-y-1">
            <div className="font-medium">Preview ({csvPreview.length} rows):</div>
            {csvPreview.slice(0, 5).map((r, i) => (
              <div key={i} className="truncate">
                <span className="font-mono text-[11px] text-muted-foreground">{r.schoolYear || "?"} · {r.term || "?"} · {r.courseName || r.subjectSlug || "?"}</span>
                <span className="ml-2">{r.title}</span>
                {r.scoreText && <span className="ml-2"> [{r.scoreText}{typeof r.scorePercent === "number" ? ` · ${r.scorePercent}%` : ""}]</span>}
              </div>
            ))}
            {csvPreview.length > 5 && <div className="text-muted-foreground">… and {csvPreview.length - 5} more</div>}
          </div>
        )}
      </Card>

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
              <Input placeholder="Grade (K, 1, 2, 3, 4, 5)" value={draft.grade || ""} onChange={(e) => setDraft({ ...draft, grade: e.target.value })} />
              <Input placeholder="School year (e.g. 2025-26)" value={draft.schoolYear || ""} onChange={(e) => setDraft({ ...draft, schoolYear: e.target.value })} />
              <Select value={draft.term || ""} onValueChange={(v) => setDraft({ ...draft, term: v })}>
                <SelectTrigger><SelectValue placeholder="Term (Q1…YR)" /></SelectTrigger>
                <SelectContent>
                  {["Q1","Q2","Q3","Q4","S1","S2","YR"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Teacher" value={draft.teacher || ""} onChange={(e) => setDraft({ ...draft, teacher: e.target.value })} />
              <Input placeholder="Course name (e.g. Math 5)" value={draft.courseName || ""} onChange={(e) => setDraft({ ...draft, courseName: e.target.value })} />
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
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All years" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={termFilter} onValueChange={setTermFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All terms</SelectItem>
              {["Q1","Q2","Q3","Q4","S1","S2","YR"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button variant={view === "flat" ? "default" : "outline"} className={view === "flat" ? "" : "bg-transparent"} size="sm" onClick={() => setView("flat")}>Flat</Button>
            <Button variant={view === "timeline" ? "default" : "outline"} className={view === "timeline" ? "" : "bg-transparent"} size="sm" onClick={() => setView("timeline")}>Timeline</Button>
          </div>
          <div className="text-xs text-muted-foreground">{filtered.length} / {rows.length}</div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground italic p-3">No records yet. Paste something above to start a record.</div>
        ) : view === "flat" ? (
          <div className="space-y-2">
            {filtered.map((r) => (
              <Card key={r.id} className="p-3 bg-white/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{r.source}</Badge>
                      <Badge variant="outline" className="text-[10px]">{r.kind}</Badge>
                      {r.subjectSlug && <Badge variant="outline" className="text-[10px] capitalize">{r.subjectSlug}</Badge>}
                      {r.schoolYear && <Badge variant="outline" className="text-[10px]">{r.schoolYear}{r.term ? ` · ${r.term}` : ""}</Badge>}
                      {r.teacher && <Badge variant="outline" className="text-[10px]">{r.teacher}</Badge>}
                      <span className="text-[11px] text-muted-foreground">{fmt(r.createdAt)}</span>
                    </div>
                    <div className="font-semibold mt-1">{r.title}</div>
                    {r.courseName && <div className="text-xs text-muted-foreground">{r.courseName}</div>}
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
        ) : (
          <div className="space-y-4">
            {groupedYears.map((yr) => (
              <Card key={yr} className="p-3 bg-white/40">
                <div className="font-semibold text-base">{yr}</div>
                <div className="space-y-3 mt-2">
                  {Object.keys(grouped[yr]).sort().map((course) => (
                    <div key={course}>
                      <div className="text-sm font-medium opacity-80">{course}</div>
                      <div className="space-y-2 mt-1">
                        {Object.keys(grouped[yr][course]).sort().map((term) => (
                          <div key={term} className="pl-3 border-l border-neutral-300 dark:border-neutral-700">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">{term}</div>
                            <div className="space-y-1 mt-1">
                              {grouped[yr][course][term].map((r: any) => (
                                <div key={r.id} className="flex items-center gap-2 text-sm">
                                  <Badge variant="outline" className="text-[10px]">{r.kind}</Badge>
                                  <span className="flex-1 truncate">{r.title}</span>
                                  {(r.scoreText || r.scorePercent != null) && (
                                    <span className="font-medium">{r.scoreText ?? `${r.scorePercent}%`}</span>
                                  )}
                                  <Button size="sm" variant="ghost" className="text-destructive h-7 px-2 text-xs" onClick={() => del(r.id)}>×</Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
