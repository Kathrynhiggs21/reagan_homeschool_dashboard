/**
 * TakeNotes — Reagan's notebook. Two modes in every note:
 *   • "Type" — a cozy text area
 *   • "Draw" — Apple-Pencil canvas powered by <DrawCanvas>
 * Notes are organized by subject + date and searchable.
 */
import { useMemo, useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DrawCanvas, { type PFStroke, type DrawCanvasHandle } from "@/components/DrawCanvas";
import { toast } from "sonner";

const COMMON_SUBJECTS = ["math", "ela", "reading", "writing", "science", "ss", "art", "music"];

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function TakeNotes() {
  const list = trpc.notes.list.useQuery({});
  const createM = trpc.notes.create.useMutation();
  const updateM = trpc.notes.update.useMutation();
  const deleteM = trpc.notes.delete.useMutation();
  const utils = trpc.useUtils();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [strokes, setStrokes] = useState<PFStroke[]>([]);
  const drawRef = useRef<DrawCanvasHandle>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"type" | "draw">("type");

  const notes = useMemo(() => (list.data as any[] | undefined) ?? [], [list.data]);
  const filtered = useMemo(() => {
    if (!query) return notes;
    const q = query.toLowerCase();
    return notes.filter((n) => (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q));
  }, [notes, query]);

  const active = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);

  useEffect(() => {
    // when activeId changes, load strokes from active into the canvas
    const s = active && Array.isArray(active.strokes) ? (active.strokes as PFStroke[]) : [];
    setStrokes(s);
    drawRef.current?.setStrokes(s);
  }, [activeId, active]);

  function newNote() {
    setActiveId(null); setTitle(""); setBody(""); setSubject(""); setStrokes([]);
  }

  function openNote(n: any) {
    setActiveId(n.id);
    setTitle(n.title || "");
    setBody(n.body || "");
    setSubject(n.subjectSlug || "");
    setStrokes(Array.isArray(n.strokes) ? n.strokes : []);
  }

  async function save() {
    if (!title.trim() && !body.trim() && strokes.length === 0) {
      toast.error("Type or draw something first."); return;
    }
    const currentStrokes = drawRef.current?.getStrokes() ?? strokes;
    const payload: any = { title, body, subjectSlug: subject || undefined, strokes: currentStrokes };
    if (active) {
      await updateM.mutateAsync({ id: active.id, ...payload });
      toast.success("Saved.");
    } else {
      const row = await createM.mutateAsync(payload);
      setActiveId((row as any)?.id ?? null);
      toast.success("Note created.");
    }
    utils.notes.list.invalidate();
  }

  async function del() {
    if (!active) return;
    if (!confirm("Delete this note?")) return;
    await deleteM.mutateAsync({ id: active.id });
    utils.notes.list.invalidate();
    newNote();
    toast.success("Deleted.");
  }

  return (
    <div className="space-y-4">
      <header className="chalkboard">
        <div className="font-chalk-hand text-xl chalk-yellow">Your Notebook</div>
        <h1 className="font-display text-3xl md:text-4xl mt-1 chalk-white">Take Notes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Jot ideas, doodle thoughts, and come back anytime. Organize by subject — type or draw with Apple Pencil.
        </p>
      </header>

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <Card className="classroom-card p-3 space-y-2">
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={newNote}>+ New note</Button>
          </div>
          <Input placeholder="Search notes..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-[50vh] overflow-auto space-y-1">
            {filtered.length === 0 && (
              <div className="text-xs text-muted-foreground p-2">No notes yet.</div>
            )}
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => openNote(n)}
                className={`w-full text-left rounded px-2 py-2 text-sm ${activeId === n.id ? "bg-primary/20" : "hover:bg-white/5"}`}
              >
                <div className="font-medium truncate">{n.title || "Untitled"}</div>
                <div className="text-[11px] text-muted-foreground flex justify-between">
                  <span>
                    {n.subjectSlug || ""}
                    {Array.isArray(n.strokes) && n.strokes.length > 0 ? " · 🎨" : ""}
                  </span>
                  <span>{fmt(n.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="classroom-card p-4 space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select value={subject || "none"} onValueChange={(v) => setSubject(v === "none" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">(none)</SelectItem>
                {COMMON_SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList>
              <TabsTrigger value="type">Type</TabsTrigger>
              <TabsTrigger value="draw">Draw ✏️</TabsTrigger>
            </TabsList>
            <TabsContent value="type" className="mt-3">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                placeholder="Write freely — you can always come back and add more."
              />
            </TabsContent>
            <TabsContent value="draw" className="mt-3">
              <div className="flex gap-2 mb-2">
                <Button size="sm" variant="outline" className="bg-transparent" onClick={() => drawRef.current?.undo()}>Undo</Button>
                <Button size="sm" variant="outline" className="bg-transparent" onClick={() => { drawRef.current?.clear(); setStrokes([]); }}>Clear</Button>
              </div>
              <div className="bg-white rounded-md overflow-hidden border">
                <DrawCanvas
                  ref={drawRef}
                  width={720}
                  height={480}
                  color="#111"
                  size={3}
                />
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">
                Tip: use Apple Pencil for pressure-aware strokes. Eraser toggles in the toolbar.
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between">
            <div>
              {active && (
                <Button variant="ghost" className="text-destructive" onClick={del}>Delete</Button>
              )}
            </div>
            <Button onClick={save}>{active ? "Save" : "Create"}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
