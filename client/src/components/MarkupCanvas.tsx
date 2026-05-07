/**
 * MarkupCanvas — full-screen overlay for marking up an image or PDF page.
 *
 * Used inside NotebookDrawer when an adult taps a thumbnail of a day
 * attachment. The original image (or first page of the PDF) is rendered
 * underneath; a transparent canvas on top captures pen / highlighter /
 * eraser strokes. On Save, the canvas is exported as a PNG data URL and
 * sent to the server (`notebookAttachments.saveMarkup`) where it lives
 * as its own S3 object so the original is never touched.
 *
 * Tools
 *  - Pen (1-color, full opacity, 3px)
 *  - Highlighter (semi-transparent, 14px)
 *  - Eraser (composite operation = destination-out)
 *  - 6 ink colors
 *  - Undo (per-stroke history)
 *  - Clear all
 *
 * For PDFs, we render the first page client-side via pdfjs-dist; markup
 * applies to that page. (Reagan's worksheets are nearly always 1-pagers,
 * so this covers the common case. If we ever need multi-page markup we
 * can iterate page indexes — schema already has `pageIndex`.)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Tool = "pen" | "highlighter" | "eraser";
const COLORS = ["#dc2626", "#0a66c2", "#16a34a", "#f59e0b", "#7c3aed", "#0f172a"] as const;

interface Props {
  attachmentId: number;
  fileUrl: string;
  kind: "image" | "pdf";
  existingMarkupUrl?: string | null;
  onClose: () => void;
}

export default function MarkupCanvas({ attachmentId, fileUrl, kind, existingMarkupUrl, onClose }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const baseImgRef = useRef<HTMLImageElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null); // PDF rendered onto here
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [size] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [history, setHistory] = useState<ImageData[]>([]);
  const [saving, setSaving] = useState(false);

  const utils = trpc.useUtils();
  const saveMutation = (trpc as any).notebookAttachments?.saveMarkup?.useMutation?.({
    onSuccess: () => {
      utils.notebookAttachments?.list?.invalidate?.();
    },
  });

  // Resize overlay to match the rendered base
  const resizeOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    const stage = stageRef.current;
    if (!overlay || !stage) return;
    const rect = stage.getBoundingClientRect();
    overlay.width = rect.width * window.devicePixelRatio;
    overlay.height = rect.height * window.devicePixelRatio;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    const ctx = overlay.getContext("2d");
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }, []);

  // Load PDF first page
  useEffect(() => {
    if (kind !== "pdf") return;
    let cancelled = false;
    (async () => {
      try {
        // Lazy-load pdfjs to avoid bundling it if unused
        const pdfjs: any = await import("pdfjs-dist");
        // Match worker version
        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        }
        const loading = pdfjs.getDocument({ url: fileUrl, withCredentials: true });
        const doc = await loading.promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = baseCanvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
        resizeOverlay();
      } catch (e) {
        console.warn("[MarkupCanvas] pdf render failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, kind, resizeOverlay]);

  useEffect(() => {
    if (kind !== "image") return;
    const img = baseImgRef.current;
    if (!img) return;
    const handler = () => resizeOverlay();
    img.addEventListener("load", handler);
    return () => img.removeEventListener("load", handler);
  }, [kind, resizeOverlay]);

  useEffect(() => {
    window.addEventListener("resize", resizeOverlay);
    return () => window.removeEventListener("resize", resizeOverlay);
  }, [resizeOverlay]);

  // Pre-paint existing markup if present
  useEffect(() => {
    if (!existingMarkupUrl) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, overlay.width / window.devicePixelRatio, overlay.height / window.devicePixelRatio);
    };
    img.src = existingMarkupUrl;
  }, [existingMarkupUrl]);

  // Drawing handlers
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  const pushHistory = () => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, overlay.width, overlay.height);
    setHistory((h) => [...h.slice(-19), snap]); // keep last 20
  };

  const ptFromEvent = (e: React.PointerEvent) => {
    const overlay = overlayRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const r = overlay.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    pushHistory();
    lastPt.current = ptFromEvent(e);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    const pt = ptFromEvent(e);
    const last = lastPt.current ?? pt;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = 18;
    } else if (tool === "highlighter") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color + "55"; // ~33% alpha
      ctx.lineWidth = 14;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
    }
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPt.current = pt;
  };
  const onPointerUp = () => {
    drawing.current = false;
    lastPt.current = null;
  };

  const undo = () => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    setHistory((h) => {
      const last = h[h.length - 1];
      if (last) ctx.putImageData(last, 0, 0);
      return h.slice(0, -1);
    });
  };
  const clearAll = () => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    pushHistory();
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  };

  const save = async () => {
    const overlay = overlayRef.current;
    if (!overlay || !saveMutation) return;
    setSaving(true);
    try {
      const dataUrl = overlay.toDataURL("image/png");
      await saveMutation.mutateAsync({ id: attachmentId, markupDataUrl: dataUrl });
      onClose();
    } catch (e) {
      console.warn("[MarkupCanvas] save failed", e);
      alert("Couldn't save markup. Try again?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-amber-50 border-b border-amber-200 text-stone-900">
        <Button size="sm" variant={tool === "pen" ? "default" : "outline"} onClick={() => setTool("pen")}>
          ✒️ Pen
        </Button>
        <Button size="sm" variant={tool === "highlighter" ? "default" : "outline"} onClick={() => setTool("highlighter")}>
          🖍️ Highlight
        </Button>
        <Button size="sm" variant={tool === "eraser" ? "default" : "outline"} onClick={() => setTool("eraser")}>
          🧽 Erase
        </Button>
        <span className="mx-2 text-xs text-stone-600">Color</span>
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-7 h-7 rounded-full border-2 ${
              color === c ? "border-stone-900 ring-2 ring-amber-400" : "border-stone-300"
            }`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
          />
        ))}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={undo}>
            ↩︎ Undo
          </Button>
          <Button size="sm" variant="outline" onClick={clearAll}>
            🗑 Clear
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "💾 Save"}
          </Button>
        </div>
      </div>
      {/* Stage */}
      <div className="flex-1 overflow-auto bg-stone-100 p-4 flex items-start justify-center">
        <div ref={stageRef} className="relative inline-block bg-white shadow-lg">
          {kind === "image" ? (
            <img
              ref={baseImgRef}
              src={fileUrl}
              alt="attachment"
              style={{ display: "block", maxWidth: "90vw", maxHeight: "82vh" }}
              draggable={false}
            />
          ) : (
            <canvas ref={baseCanvasRef} style={{ display: "block", maxWidth: "90vw", maxHeight: "82vh" }} />
          )}
          <canvas
            ref={overlayRef}
            className="absolute inset-0 cursor-crosshair touch-none"
            style={{ width: "100%", height: "100%" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </div>
      </div>
    </div>
  );
}
