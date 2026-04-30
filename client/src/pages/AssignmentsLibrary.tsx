import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const TYPES = [
  "worksheet",
  "video",
  "slideshow",
  "lesson_plan",
  "quiz",
  "answer_key",
  "project",
  "app_activity",
  "reading",
  "other",
] as const;

const SUBJECTS = [
  "math",
  "ela",
  "reading",
  "writing",
  "science",
  "ss",
  "art",
  "music",
  "other",
] as const;

const STATUSES = ["pending", "in_progress", "completed", "absent", "skipped"] as const;

const SOURCE_PRESETS = [
  "IH (printout)",
  "IH Classroom",
  "IH Email",
  "IXL",
  "Khan Academy",
  "ReadWorks",
  "Schoology",
  "Education.com",
  "NASA",
  "Smithsonian",
  "Storyline Online",
  "Mystery Science",
  "Google Drive",
  "Email",
  "Manual",
];

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="inline-flex gap-0.5" role="radiogroup" aria-label="Recommended use">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className={`text-base ${n <= value ? "text-amber-400" : "text-muted-foreground/30"} ${onChange ? "hover:scale-110 transition" : "cursor-default"}`}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-slate-500/20 text-slate-200 border-slate-500/40",
    in_progress: "bg-amber-500/20 text-amber-200 border-amber-500/40",
    completed: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
    absent: "bg-rose-500/20 text-rose-200 border-rose-500/40",
    skipped: "bg-zinc-500/20 text-zinc-200 border-zinc-500/40",
  };
  return (
    <Badge variant="outline" className={`${map[status] ?? map.pending} text-[10px] uppercase tracking-wider`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

export default function AssignmentsLibrary() {
  // Filters
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [ihOnly, setIhOnly] = useState(false);
  const [orderBy, setOrderBy] = useState<"recent" | "dateFor" | "recommendedUse" | "title">("recent");

  const filterArg = useMemo(
    () => ({
      q: q.trim() || undefined,
      subjectSlug: subject === "all" ? null : subject,
      type: type === "all" ? null : type,
      status: status === "all" ? null : status,
      ihClassroomOnly: ihOnly,
      orderBy,
      limit: 200,
      offset: 0,
    }),
    [q, subject, type, status, ihOnly, orderBy],
  );

  const list = trpc.library.list.useQuery(filterArg);
  const utils = trpc.useUtils();

  // Add form
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subjectSlug: "ela" as string,
    type: "worksheet" as string,
    topic: "",
    fromSource: "Manual" as string,
    ihClassroom: false,
    dateFor: new Date().toISOString().slice(0, 10),
    recommendedUse: 4,
    sourceUrl: "",
    fileLink: "",
    notes: "",
  });
  const addMut = trpc.library.add.useMutation({
    onSuccess: () => {
      toast.success("Added to Library");
      setAddOpen(false);
      setForm((f) => ({ ...f, title: "", topic: "", sourceUrl: "", fileLink: "", notes: "" }));
      utils.library.list.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Add failed"),
  });

  const setStatusMut = trpc.library.setStatus.useMutation({
    onSuccess: () => utils.library.list.invalidate(),
  });

  const items = list.data ?? [];

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl chalk-white">Assignments Library</h1>
          <p className="text-sm text-muted-foreground">
            Every worksheet, video, lesson, and activity — IH-assigned or otherwise — in one searchable place.
            Items here populate the daily schedule blocks and the photo turn-in flow.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-amber-500 hover:bg-amber-400 text-amber-950">
          + Add to Library
        </Button>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title / topic / notes…"
            className="w-64"
          />
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ihOnly} onChange={(e) => setIhOnly(e.target.checked)} />
            IH only
          </label>
          <Select value={orderBy} onValueChange={(v: any) => setOrderBy(v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recently added</SelectItem>
              <SelectItem value="dateFor">Date intended for</SelectItem>
              <SelectItem value="recommendedUse">Recommended ★</SelectItem>
              <SelectItem value="title">Title A→Z</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{items.length} items</span>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Topic</th>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">IH</th>
                <th className="px-3 py-2">Date for</th>
                <th className="px-3 py-2">★</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Links</th>
                <th className="px-3 py-2 text-right">Quick</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && (
                <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!list.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-muted-foreground">
                    Nothing in the Library yet. Add manually with <strong>+ Add to Library</strong>, or wait for the daily 6 AM auto-sync from Reagan&apos;s IH Gmail / Drive / Classroom.
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr key={row.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2 max-w-[18rem]">
                    <div className="font-medium truncate">{row.title}</div>
                    {row.notes && <div className="text-xs text-muted-foreground truncate">{row.notes}</div>}
                  </td>
                  <td className="px-3 py-2 uppercase text-xs">{row.subjectSlug ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.type.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-xs">{row.topic ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.fromSource}</td>
                  <td className="px-3 py-2 text-xs">{row.ihClassroom ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{row.dateFor ?? "—"}</td>
                  <td className="px-3 py-2"><StarRating value={row.recommendedUse} /></td>
                  <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                  <td className="px-3 py-2 text-xs space-x-2">
                    {row.sourceUrl && (
                      <a className="underline text-amber-300" href={row.sourceUrl} target="_blank" rel="noreferrer">page</a>
                    )}
                    {row.fileLink && (
                      <a className="underline text-emerald-300" href={row.fileLink} target="_blank" rel="noreferrer">file</a>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Select
                      value={row.status}
                      onValueChange={(v) => setStatusMut.mutate({ id: row.id, status: v as any })}
                    >
                      <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add to Library</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 text-xs space-y-1">
              <span>Title</span>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="text-xs space-y-1">
              <span>Subject</span>
              <Select value={form.subjectSlug} onValueChange={(v) => setForm({ ...form, subjectSlug: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="text-xs space-y-1">
              <span>Type</span>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="text-xs space-y-1">
              <span>Topic</span>
              <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Decimal multiplication" />
            </label>
            <label className="text-xs space-y-1">
              <span>From (where Reagan got it)</span>
              <Select value={form.fromSource} onValueChange={(v) => setForm({ ...form, fromSource: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCE_PRESETS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="text-xs space-y-1">
              <span>IH Classroom?</span>
              <div className="flex items-center gap-2 h-9">
                <input type="checkbox" checked={form.ihClassroom} onChange={(e) => setForm({ ...form, ihClassroom: e.target.checked })} />
                <span className="text-xs text-muted-foreground">Yes if Indian Hill assigned this</span>
              </div>
            </label>
            <label className="text-xs space-y-1">
              <span>Date for</span>
              <Input type="date" value={form.dateFor} onChange={(e) => setForm({ ...form, dateFor: e.target.value })} />
            </label>
            <label className="text-xs space-y-1">
              <span>Recommended use</span>
              <div><StarRating value={form.recommendedUse} onChange={(v) => setForm({ ...form, recommendedUse: v })} /></div>
            </label>
            <label className="col-span-2 text-xs space-y-1">
              <span>Source URL (the page / app / website)</span>
              <Input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://" />
            </label>
            <label className="col-span-2 text-xs space-y-1">
              <span>File link (Drive editable copy / attachment)</span>
              <Input value={form.fileLink} onChange={(e) => setForm({ ...form, fileLink: e.target.value })} placeholder="https://drive.google.com/…" />
            </label>
            <label className="col-span-2 text-xs space-y-1">
              <span>Notes</span>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.title.trim() || addMut.isPending}
              onClick={() =>
                addMut.mutate({
                  title: form.title.trim(),
                  subjectSlug: form.subjectSlug,
                  type: form.type,
                  topic: form.topic.trim() || undefined,
                  fromSource: form.fromSource,
                  ihClassroom: form.ihClassroom,
                  dateFor: form.dateFor || undefined,
                  recommendedUse: form.recommendedUse,
                  sourceUrl: form.sourceUrl.trim() || undefined,
                  fileLink: form.fileLink.trim() || undefined,
                  notes: form.notes.trim() || undefined,
                })
              }
            >
              {addMut.isPending ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
