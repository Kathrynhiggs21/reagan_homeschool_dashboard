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
import PrintButton from "@/components/PrintButton";

const COMMON_SUBJECTS = ["math", "ela", "reading", "writing", "science", "ss", "art", "music"];

// Paper templates Reagan can pick — pure CSS so they print cleanly too.
const PAPER_TEMPLATES: Record<string, { label: string; emoji: string; backgroundImage: string; backgroundSize: string; backgroundColor: string }> = {
  blank: {
    label: "Blank", emoji: "⬜",
    backgroundColor: "#fffdf6",
    backgroundImage: "none",
    backgroundSize: "auto",
  },
  lined: {
    label: "Lined", emoji: "📝",
    backgroundColor: "#fffdf6",
    backgroundImage: "linear-gradient(transparent 30px, rgba(0,80,200,0.18) 31px)",
    backgroundSize: "100% 32px",
  },
  graph: {
    label: "Graph", emoji: "📐",
    backgroundColor: "#fffdf6",
    backgroundImage:
      "linear-gradient(rgba(0,128,128,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(0,128,128,0.18) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
  },
  dotted: {
    label: "Dotted", emoji: "⠿",
    backgroundColor: "#fffdf6",
    backgroundImage:
      "radial-gradient(rgba(60,40,20,0.4) 1px, transparent 1.5px)",
    backgroundSize: "20px 20px",
  },
  handwriting: {
    label: "Handwriting", emoji: "✍️",
    backgroundColor: "#fffdf6",
    backgroundImage:
      "linear-gradient(transparent 28px, rgba(220,40,40,0.45) 29px, rgba(220,40,40,0.45) 30px, transparent 31px, transparent 44px, rgba(0,80,200,0.4) 45px, rgba(0,80,200,0.4) 46px, transparent 47px, transparent 60px, rgba(220,40,40,0.45) 61px, rgba(220,40,40,0.45) 62px, transparent 63px)",
    backgroundSize: "100% 64px",
  },
};

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
  const [mode, setMode] = useState<"type" | "draw" | "mixed">("type");
  const [paper, setPaper] = useState<keyof typeof PAPER_TEMPLATES>("lined");

  // Simple read-aloud helper using the browser's speech synthesis.
  const readAloud = (text: string | null | undefined) => {
    if (!text) {
      toast.message("Nothing to read here yet.");
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("This browser doesn't support read-aloud.");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 1.05;
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    } catch {
      toast.error("Couldn't start read-aloud.");
    }
  };
  const stopReading = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  };

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
      <header className="chalkboard relative">
        <div className="font-chalk-hand text-xl chalk-yellow">Your Notebook</div>
        <h1 className="font-display text-3xl md:text-4xl mt-1 chalk-white">Take Notes</h1>
        <NotebookKiwiHelper />
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

          {/* Paper-template + read-aloud + print toolbar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground font-semibold">Paper:</span>
            {(Object.keys(PAPER_TEMPLATES) as Array<keyof typeof PAPER_TEMPLATES>).map((k) => (
              <button
                key={k}
                onClick={() => setPaper(k)}
                className={`px-2 py-1 rounded-md border ${paper === k ? "bg-primary text-primary-foreground border-primary" : "bg-white/5 border-white/10"}`}
              >
                {PAPER_TEMPLATES[k].emoji} {PAPER_TEMPLATES[k].label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" className="bg-transparent" onClick={() => readAloud(`${title}. ${body}`)}>
                🔊 Read this to me
              </Button>
              <Button size="sm" variant="outline" className="bg-transparent" onClick={stopReading}>
                ⏹ Stop
              </Button>
              <PrintButton size="sm" />
            </div>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList>
              <TabsTrigger value="type">Type</TabsTrigger>
              <TabsTrigger value="draw">Draw ✏️</TabsTrigger>
              <TabsTrigger value="mixed">Mixed 📝✏️</TabsTrigger>
            </TabsList>
            <TabsContent value="type" className="mt-3">
              <div
                className="rounded-md p-3"
                style={{
                  backgroundColor: PAPER_TEMPLATES[paper].backgroundColor,
                  backgroundImage: PAPER_TEMPLATES[paper].backgroundImage,
                  backgroundSize: PAPER_TEMPLATES[paper].backgroundSize,
                }}
              >
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={28}
                  placeholder="Write freely — you can always come back and add more."
                  className="min-h-[600px] bg-transparent border-0 focus-visible:ring-0 text-base leading-8 text-slate-900"
                  style={{ fontFamily: "'Caveat', 'Patrick Hand', cursive", fontSize: 22, lineHeight: "32px" }}
                />
              </div>
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
            <TabsContent value="mixed" className="mt-3 space-y-3">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="Write the typed part on top..."
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="bg-transparent" onClick={() => drawRef.current?.undo()}>Undo</Button>
                <Button size="sm" variant="outline" className="bg-transparent" onClick={() => { drawRef.current?.clear(); setStrokes([]); }}>Clear</Button>
              </div>
              <div className="bg-white rounded-md overflow-hidden border">
                <DrawCanvas
                  ref={drawRef}
                  width={720}
                  height={360}
                  color="#111"
                  size={3}
                />
              </div>
              <div className="text-[11px] text-muted-foreground">Type and draw in the same note — both save together.</div>
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


/**
 * NotebookKiwiHelper — small Notebook-only Kiwi popover.
 *
 * Why scope to Notebook: a global Kiwi nav item has been deliberately avoided
 * because Reagan's Today page already has the big "Ask Kiwi" button. Keeping
 * a smaller helper inline in Notebook lets her ask quick questions without
 * leaving her writing/drawing flow.
 */
function NotebookKiwiHelper() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const chatM = trpc.kiwi.chat.useMutation();

  async function ask() {
    if (!q.trim()) return;
    try {
      const r = await chatM.mutateAsync({ userMessage: q, adultPresent: false });
      setReply(r.reply);
    } catch (err: any) {
      setReply("(Kiwi got tangled. Try again in a moment.)");
    }
  }

  return (
    <div className="absolute top-2 right-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold border border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 shadow-sm"
          aria-label="Open small Kiwi helper"
          title="Quick question for Kiwi"
        >
          🦜 Ask Kiwi
        </button>
      ) : (
        <div className="w-72 rounded-xl bg-white text-slate-900 border border-amber-300 shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-amber-900">🦜 Quick question</div>
            <button
              type="button"
              onClick={() => { setOpen(false); setReply(null); setQ(""); }}
              className="text-xs text-slate-500 hover:text-slate-800"
              aria-label="Close Kiwi helper"
            >
              ✕
            </button>
          </div>
          <Textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="What does 'denominator' mean?"
            className="text-sm bg-amber-50 border-amber-200" />
          <div className="flex gap-2 justify-end">
            <Button size="sm" onClick={ask} disabled={chatM.isPending || !q.trim()}>
              {chatM.isPending ? "Asking…" : "Ask"}
            </Button>
          </div>
          {reply && (
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-md p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {reply}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
