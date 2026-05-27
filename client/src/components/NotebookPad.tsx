/**
 * NotebookPad — full-screen adult writing pad.
 *
 * Features:
 *   • Paper background picker: blank, lined, graph, dotted, handwriting
 *   • Mode: Type (rich textarea with [x] checkbox support) / Draw (DrawCanvas)
 *   • Pen color picker + size
 *   • Checkbox toolbar (insert [ ] or [x] at cursor)
 *   • Media: handled by parent (NotebookDrawer)
 *   • Auto-save on blur / 2s debounce
 *   • Per-day, per-page persistence via notebookPages tRPC router
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import DrawCanvas, { type DrawCanvasHandle, type PFStroke } from "@/components/DrawCanvas";

/* ─── Paper templates ─────────────────────────────────────────────────────── */
const PAPER: Record<string, {
  label: string; emoji: string;
  backgroundColor: string; backgroundImage: string; backgroundSize: string;
}> = {
  blank: {
    label: "Blank", emoji: "⬜",
    backgroundColor: "#fffdf6", backgroundImage: "none", backgroundSize: "auto",
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
    backgroundImage: "radial-gradient(rgba(60,40,20,0.4) 1px, transparent 1.5px)",
    backgroundSize: "20px 20px",
  },
  handwriting: {
    label: "Handwriting", emoji: "✍️",
    backgroundColor: "#fffdf6",
    backgroundImage:
      "linear-gradient(transparent 28px, rgba(220,40,40,0.45) 29px, rgba(220,40,40,0.45) 30px, transparent 31px, transparent 44px, rgba(0,80,200,0.4) 45px, rgba(0,80,200,0.4) 46px, transparent 47px, transparent 60px, rgba(220,40,40,0.45) 61px, rgba(220,40,40,0.45) 62px, transparent 63px)",
    backgroundSize: "100% 64px",
  },
  cream: {
    label: "Cream", emoji: "📒",
    backgroundColor: "#fdf6e3", backgroundImage: "none", backgroundSize: "auto",
  },
  white: {
    label: "White", emoji: "🗒️",
    backgroundColor: "#ffffff", backgroundImage: "none", backgroundSize: "auto",
  },
};

const PEN_COLORS = ["#111111", "#1a56db", "#d03030", "#16a34a", "#7c3aed", "#ea580c", "#0891b2", "#be185d"];
const PEN_SIZES = [2, 4, 7, 12];

type Mode = "type" | "draw";

interface NotebookPadProps {
  dateStr: string;
  pageIndex?: number;
  onClose: () => void;
}

export default function NotebookPad({ dateStr, pageIndex = 0, onClose }: NotebookPadProps) {
  const utils = trpc.useUtils();

  /* ─── Server state ───────────────────────────────────────────────────────── */
  const pageQ = (trpc as any).notebookPages?.get?.useQuery?.({ dateStr, pageIndex }, {
    staleTime: 30_000,
  }) ?? { data: null, isLoading: false };
  const saveMutation = (trpc as any).notebookPages?.save?.useMutation?.({
    onSuccess: () => (utils as any).notebookPages?.get?.invalidate?.({ dateStr, pageIndex }),
  });

  /* ─── Local state ────────────────────────────────────────────────────────── */
  const [mode, setMode] = useState<Mode>("type");
  const [paper, setPaper] = useState<string>("lined");
  const [text, setText] = useState<string>("");
  const [penColor, setPenColor] = useState<string>("#111111");
  const [penSize, setPenSize] = useState<number>(4);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const drawRef = useRef<DrawCanvasHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Load saved page on mount ───────────────────────────────────────────── */
  useEffect(() => {
    const row = pageQ.data as any;
    if (!row) return;
    if (row.paperStyle) setPaper(row.paperStyle);
    if (row.textContent != null) setText(row.textContent ?? "");
    if (row.penColor) setPenColor(row.penColor);
    if (row.drawingStrokes && drawRef.current) {
      try {
        const strokes: PFStroke[] = JSON.parse(row.drawingStrokes);
        drawRef.current.setStrokes(strokes);
      } catch { /* ignore */ }
    }
  }, [pageQ.data]);

  /* ─── Auto-save ──────────────────────────────────────────────────────────── */
  const doSave = useCallback(async () => {
    if (!dirty || !saveMutation) return;
    setSaving(true);
    try {
      let drawingStrokes: string | null = null;
      if (drawRef.current) {
        const strokes = drawRef.current.getStrokes();
        drawingStrokes = JSON.stringify(strokes);
      }
      await saveMutation.mutateAsync({
        dateStr, pageIndex,
        paperStyle: paper,
        textContent: text,
        drawingStrokes,
        penColor,
      });
      setDirty(false);
    } catch {
      toast.error("Couldn't save notebook page.");
    } finally {
      setSaving(false);
    }
  }, [dirty, dateStr, pageIndex, paper, text, penColor, saveMutation]);

  /* Debounced auto-save on text change */
  useEffect(() => {
    if (!dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dirty, text, paper, penColor, doSave]);

  const markDirty = () => setDirty(true);

  /* ─── Checkbox helpers ───────────────────────────────────────────────────── */
  const insertAtCursor = (snippet: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setText(prev => prev + snippet);
      markDirty();
      return;
    }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const newText = text.slice(0, start) + snippet + text.slice(end);
    setText(newText);
    markDirty();
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + snippet.length;
      ta.focus();
    });
  };

  /* Toggle [ ] ↔ [x] on the line under cursor */
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
        setText(lines.join("\n"));
        markDirty();
        break;
      }
    }
  };

  const paperStyle = PAPER[paper] ?? PAPER.lined;

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-stone-900/90">
      {/* ── Toolbar ── */}
      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-amber-200"
        style={{ background: "#fdf6e3", color: "#1c1917" }}
      >
        {/* Mode toggle */}
        <div className="flex rounded-md overflow-hidden border border-amber-300">
          <button
            type="button"
            onClick={() => setMode("type")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${mode === "type" ? "bg-amber-200 text-stone-900" : "bg-white text-stone-700 hover:bg-amber-50"}`}
          >
            ✏️ Type
          </button>
          <button
            type="button"
            onClick={() => setMode("draw")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${mode === "draw" ? "bg-amber-200 text-stone-900" : "bg-white text-stone-700 hover:bg-amber-50"}`}
          >
            🖊️ Draw
          </button>
        </div>

        {/* Paper picker */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-stone-600 mr-1">Paper:</span>
          {Object.entries(PAPER).map(([key, p]) => (
            <button
              key={key}
              type="button"
              title={p.label}
              onClick={() => { setPaper(key); markDirty(); }}
              className={`w-7 h-7 rounded border text-sm flex items-center justify-center transition-all ${
                paper === key ? "border-amber-500 ring-2 ring-amber-300 bg-amber-100" : "border-stone-300 bg-white hover:bg-amber-50"
              }`}
            >
              {p.emoji}
            </button>
          ))}
        </div>

        {/* Type-mode extras */}
        {mode === "type" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Insert checkbox"
              onClick={() => insertAtCursor("\n[ ] ")}
              className="px-2 py-1 text-xs rounded border border-stone-300 bg-white hover:bg-amber-50"
            >
              ☐ Add checkbox
            </button>
            <button
              type="button"
              title="Toggle checkbox on current line"
              onClick={toggleCheckbox}
              className="px-2 py-1 text-xs rounded border border-stone-300 bg-white hover:bg-amber-50"
            >
              ✓ Toggle
            </button>
          </div>
        )}

        {/* Draw-mode extras */}
        {mode === "draw" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-600">Color:</span>
            {PEN_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setPenColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${penColor === c ? "border-stone-900 ring-2 ring-amber-400 scale-110" : "border-stone-300"}`}
                style={{ background: c }}
                aria-label={`Pen color ${c}`}
              />
            ))}
            <span className="text-xs text-stone-600 ml-2">Size:</span>
            {PEN_SIZES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setPenSize(s)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${penSize === s ? "border-amber-500 bg-amber-100" : "border-stone-300 bg-white"}`}
              >
                <span style={{ width: s, height: s, borderRadius: "50%", background: penColor, display: "block" }} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => drawRef.current?.undo()}
              className="px-2 py-1 text-xs rounded border border-stone-300 bg-white hover:bg-amber-50"
            >
              ↩ Undo
            </button>
            <button
              type="button"
              onClick={() => { drawRef.current?.clear(); markDirty(); }}
              className="px-2 py-1 text-xs rounded border border-stone-300 bg-white hover:bg-amber-50"
            >
              🗑 Clear
            </button>
          </div>
        )}

        {/* Right side: save + close */}
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-stone-500 italic">
              {saving ? "Saving…" : "Unsaved"}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="bg-white border-amber-300 text-stone-800 hover:bg-amber-50"
            onClick={async () => { await doSave(); }}
            disabled={saving}
          >
            💾 Save
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={async () => { await doSave(); onClose(); }}
          >
            ✕ Close
          </Button>
        </div>
      </div>

      {/* ── Writing area ── */}
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
        <div
          className="w-full max-w-3xl min-h-full rounded-lg shadow-xl"
          style={{
            backgroundColor: paperStyle.backgroundColor,
            backgroundImage: paperStyle.backgroundImage,
            backgroundSize: paperStyle.backgroundSize,
          }}
        >
          {mode === "type" ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => { setText(e.target.value); markDirty(); }}
              className="w-full min-h-[80vh] p-6 text-base leading-8 font-mono resize-none outline-none"
              style={{
                background: "transparent",
                color: "#1c1917",
                lineHeight: "32px",
                caretColor: "#1a56db",
              }}
              placeholder="Start writing… type [ ] for a checkbox, or use the toolbar above."
              spellCheck
            />
          ) : (
            <div className="w-full min-h-[80vh] relative">
              <DrawCanvas
                ref={drawRef}
                width={768}
                height={1024}
                color={penColor}
                size={penSize}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
