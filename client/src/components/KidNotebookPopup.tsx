/**
 * KidNotebookPopup — Reagan's notebook, opened from the floating dock.
 *
 * 2026-06-17 (Katy): the notebook is no longer a sidebar page. It's a rich
 * pop-up panel Reagan (or Kiwi) can open while doing her work. It keeps all
 * the good parts of the old notebook:
 *   • Paper picker: blank / lined / graph / dotted / handwriting / cream
 *   • Type mode (with checkbox tools) and Draw mode (pen color + size)
 *   • Handwriting -> typed text (transcription only, NOT read-aloud)
 *   • Auto-saves to the same notebookPages rows; server mirrors typed notes
 *     into the Drive "journal" notes folder so saved notes live in Drive.
 *
 * It is fully self-contained and uses the kid-accessible tRPC procedures
 * (notebookPages.kidGet / kidSave / ocr) so it works without an adult login.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import DrawCanvas, { type DrawCanvasHandle, type PFStroke } from "@/components/DrawCanvas";

const PAPER: Record<string, {
  label: string; emoji: string;
  backgroundColor: string; backgroundImage: string; backgroundSize: string;
}> = {
  blank:  { label: "Blank", emoji: "⬜", backgroundColor: "#fffdf6", backgroundImage: "none", backgroundSize: "auto" },
  lined:  { label: "Lined", emoji: "📝", backgroundColor: "#fffdf6", backgroundImage: "linear-gradient(transparent 30px, rgba(0,80,200,0.18) 31px)", backgroundSize: "100% 32px" },
  graph:  { label: "Graph", emoji: "📐", backgroundColor: "#fffdf6", backgroundImage: "linear-gradient(rgba(0,128,128,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(0,128,128,0.18) 1px, transparent 1px)", backgroundSize: "24px 24px" },
  dotted: { label: "Dotted", emoji: "⠿", backgroundColor: "#fffdf6", backgroundImage: "radial-gradient(rgba(60,40,20,0.4) 1px, transparent 1.5px)", backgroundSize: "20px 20px" },
  handwriting: { label: "Handwriting", emoji: "✍️", backgroundColor: "#fffdf6", backgroundImage: "linear-gradient(transparent 28px, rgba(220,40,40,0.45) 29px, rgba(220,40,40,0.45) 30px, transparent 31px, transparent 44px, rgba(0,80,200,0.4) 45px, rgba(0,80,200,0.4) 46px, transparent 47px, transparent 60px, rgba(220,40,40,0.45) 61px, rgba(220,40,40,0.45) 62px, transparent 63px)", backgroundSize: "100% 64px" },
  cream:  { label: "Cream", emoji: "📒", backgroundColor: "#fdf6e3", backgroundImage: "none", backgroundSize: "auto" },
};

const PEN_COLORS = ["#111111", "#1a56db", "#d03030", "#16a34a", "#7c3aed", "#ea580c", "#0891b2", "#be185d"];
const PEN_SIZES = [2, 4, 7, 12];

type Mode = "type" | "draw";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function KidNotebookPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dateStr] = useState(() => todayStr());
  const pageIndex = 0;

  const pageQ = (trpc as any).notebookPages?.kidGet?.useQuery?.(
    { dateStr, pageIndex },
    { enabled: open, staleTime: 30_000 },
  ) ?? { data: null };
  const saveMutation = (trpc as any).notebookPages?.kidSave?.useMutation?.();
  const ocrMutation = (trpc as any).notebookPages?.ocr?.useMutation?.();

  const [mode, setMode] = useState<Mode>("type");
  const [paper, setPaper] = useState<string>("lined");
  const [text, setText] = useState<string>("");
  const [penColor, setPenColor] = useState<string>("#111111");
  const [penSize, setPenSize] = useState<number>(4);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const drawRef = useRef<DrawCanvasHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved page when opened
  useEffect(() => {
    const row = (pageQ as any).data;
    if (!row) return;
    if (row.paperStyle) setPaper(row.paperStyle);
    if (row.textContent != null) setText(row.textContent ?? "");
    if (row.penColor) setPenColor(row.penColor);
    if (row.drawingStrokes && drawRef.current) {
      try { drawRef.current.setStrokes(JSON.parse(row.drawingStrokes) as PFStroke[]); } catch { /* ignore */ }
    }
  }, [(pageQ as any).data]);

  const doSave = useCallback(async () => {
    if (!dirty || !saveMutation) return;
    setSaving(true);
    try {
      let drawingStrokes: string | null = null;
      if (drawRef.current) drawingStrokes = JSON.stringify(drawRef.current.getStrokes());
      await saveMutation.mutateAsync({ dateStr, pageIndex, paperStyle: paper, textContent: text, drawingStrokes, penColor });
      setDirty(false);
    } catch {
      toast.error("Couldn't save your notebook.");
    } finally {
      setSaving(false);
    }
  }, [dirty, dateStr, paper, text, penColor, saveMutation]);

  // Debounced auto-save
  useEffect(() => {
    if (!dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dirty, text, paper, penColor, doSave]);

  const markDirty = () => setDirty(true);

  const insertAtCursor = (snippet: string) => {
    const ta = textareaRef.current;
    if (!ta) { setText((p) => p + snippet); markDirty(); return; }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    setText(text.slice(0, start) + snippet + text.slice(end));
    markDirty();
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + snippet.length; ta.focus(); });
  };

  const toggleCheckbox = () => {
    const ta = textareaRef.current;
    const pos = ta?.selectionStart ?? 0;
    const lines = text.split("\n");
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      charCount += lines[i].length + 1;
      if (charCount > pos) {
        if (lines[i].includes("[ ]")) lines[i] = lines[i].replace("[ ]", "[x]");
        else if (lines[i].includes("[x]")) lines[i] = lines[i].replace("[x]", "[ ]");
        else lines[i] = "[ ] " + lines[i];
        setText(lines.join("\n")); markDirty(); break;
      }
    }
  };

  // Handwriting -> typed text (transcription only)
  const readHandwriting = async () => {
    if (!drawRef.current || !ocrMutation) return;
    setReading(true);
    try {
      const dataUrl = drawRef.current.toPNG();
      const res = await ocrMutation.mutateAsync({ imageDataUrl: dataUrl });
      const got = (res?.text ?? "").trim();
      if (got) {
        setMode("type");
        setText((prev) => (prev ? prev + "\n" + got : got));
        markDirty();
        toast.success("Turned your handwriting into text!");
      } else {
        toast.error(res?.error || "Couldn't read that — try writing a bit bigger.");
      }
    } catch {
      toast.error("Couldn't read the handwriting right now.");
    } finally {
      setReading(false);
    }
  };

  const paperStyle = PAPER[paper] ?? PAPER.lined;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { void doSave(); onClose(); } }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="font-display flex items-center gap-2">📝 My Notebook</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b" style={{ background: "#fdf6e3", color: "#1c1917" }}>
          <div className="flex rounded-md overflow-hidden border border-amber-300">
            <button type="button" onClick={() => setMode("type")} className={`px-3 py-1.5 text-sm font-medium ${mode === "type" ? "bg-amber-200 text-stone-900" : "bg-white text-stone-700 hover:bg-amber-50"}`}>✏️ Type</button>
            <button type="button" onClick={() => setMode("draw")} className={`px-3 py-1.5 text-sm font-medium ${mode === "draw" ? "bg-amber-200 text-stone-900" : "bg-white text-stone-700 hover:bg-amber-50"}`}>🖊️ Draw</button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-stone-600 mr-1">Paper:</span>
            {Object.entries(PAPER).map(([key, p]) => (
              <button key={key} type="button" title={p.label} onClick={() => { setPaper(key); markDirty(); }}
                className={`w-7 h-7 rounded border text-sm flex items-center justify-center ${paper === key ? "border-amber-500 ring-2 ring-amber-300 bg-amber-100" : "border-stone-300 bg-white hover:bg-amber-50"}`}>
                {p.emoji}
              </button>
            ))}
          </div>

          {mode === "type" && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => insertAtCursor("\n[ ] ")} className="px-2 py-1 text-xs rounded border border-stone-300 bg-white hover:bg-amber-50">☐ Checkbox</button>
              <button type="button" onClick={toggleCheckbox} className="px-2 py-1 text-xs rounded border border-stone-300 bg-white hover:bg-amber-50">✓ Toggle</button>
            </div>
          )}

          {mode === "draw" && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-600">Color:</span>
              {PEN_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setPenColor(c)} aria-label={`Pen ${c}`}
                  className={`w-6 h-6 rounded-full border-2 ${penColor === c ? "border-stone-900 ring-2 ring-amber-400 scale-110" : "border-stone-300"}`} style={{ background: c }} />
              ))}
              <span className="text-xs text-stone-600 ml-1">Size:</span>
              {PEN_SIZES.map((s) => (
                <button key={s} type="button" onClick={() => setPenSize(s)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${penSize === s ? "border-amber-500 bg-amber-100" : "border-stone-300 bg-white"}`}>
                  <span style={{ width: s, height: s, borderRadius: "50%", background: penColor, display: "block" }} />
                </button>
              ))}
              <button type="button" onClick={() => drawRef.current?.undo()} className="px-2 py-1 text-xs rounded border border-stone-300 bg-white hover:bg-amber-50">↩ Undo</button>
              <button type="button" onClick={() => { drawRef.current?.clear(); markDirty(); }} className="px-2 py-1 text-xs rounded border border-stone-300 bg-white hover:bg-amber-50">🗑 Clear</button>
              <button type="button" onClick={readHandwriting} disabled={reading} className="px-2 py-1 text-xs rounded border border-amber-400 bg-amber-100 hover:bg-amber-200 font-medium">
                {reading ? "Reading…" : "✍️→Aa Handwriting to text"}
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-xs text-stone-500 italic">{saving ? "Saving…" : "Unsaved"}</span>}
            <Button size="sm" variant="outline" className="bg-white border-amber-300 text-stone-800 hover:bg-amber-50" onClick={() => void doSave()} disabled={saving}>💾 Save</Button>
          </div>
        </div>

        {/* Writing area */}
        <div className="max-h-[60vh] overflow-auto p-4 flex items-start justify-center bg-stone-100">
          <div className="w-full max-w-2xl rounded-lg shadow-md" style={{ backgroundColor: paperStyle.backgroundColor, backgroundImage: paperStyle.backgroundImage, backgroundSize: paperStyle.backgroundSize }}>
            {mode === "type" ? (
              <textarea ref={textareaRef} value={text} onChange={(e) => { setText(e.target.value); markDirty(); }}
                className="w-full min-h-[50vh] p-5 text-base leading-8 font-mono resize-none outline-none"
                style={{ background: "transparent", color: "#1c1917", lineHeight: "32px", caretColor: "#1a56db" }}
                placeholder="Start writing… type [ ] for a checkbox, or use the buttons above." spellCheck />
            ) : (
              <div className="w-full min-h-[50vh] relative">
                <DrawCanvas ref={drawRef} width={672} height={900} color={penColor} size={penSize} className="w-full" />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
