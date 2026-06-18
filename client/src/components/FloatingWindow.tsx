import { useCallback, useEffect, useRef, useState } from "react";

/**
 * FloatingWindow — a draggable, non-blocking floating panel.
 *
 * 2026-06-18 (Katy): Reagan's dock tools (Notebook / Timer / Calculator / Word)
 * used to open as blocking modal Dialogs — opening one dimmed the page and you
 * couldn't use the site behind it, and switching pages closed the tool. This
 * component fixes both: it renders OUTSIDE any backdrop, can be dragged around
 * by its title bar, and stays mounted while Reagan navigates the rest of the
 * site (the dock owns the open/closed state, not a route).
 *
 * Intentionally framework-light: no portal, no focus trap, no backdrop. It's a
 * positioned panel that floats above the page (z-40, below Kiwi's z-50) and
 * never steals interaction from the page underneath.
 *
 * Behaviour:
 *   • Drag by the header to reposition. Position is clamped to the viewport so
 *     it can never be dragged fully off-screen.
 *   • Minimize collapses to just the title bar (keeps state alive).
 *   • Close calls onClose.
 *   • Works with both mouse and touch (Reagan is on a tablet a lot).
 */

export interface FloatingWindowProps {
  open: boolean;
  title: string;
  emoji?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Initial top-left position; defaults to a sensible spot above the dock. */
  initial?: { x: number; y: number };
  /** Fixed content width in px (the panel auto-heights to content). */
  width?: number;
  /** data-testid passthrough for contract tests. */
  testId?: string;
}

function clampToViewport(x: number, y: number, w: number, h: number) {
  const maxX = Math.max(8, window.innerWidth - w - 8);
  const maxY = Math.max(8, window.innerHeight - h - 8);
  return {
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
  };
}

export default function FloatingWindow({
  open,
  title,
  emoji,
  onClose,
  children,
  initial,
  width = 380,
  testId,
}: FloatingWindowProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [minimized, setMinimized] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ dx: number; dy: number } | null>(null);

  // Pick an initial position the first time the window opens (or on resize if
  // it would land off-screen). Default: lower-left, clear of the dock.
  useEffect(() => {
    if (!open) return;
    if (pos) return;
    const w = width;
    const h = panelRef.current?.offsetHeight ?? 320;
    const def = initial ?? {
      x: 24,
      y: Math.max(24, window.innerHeight - h - 110),
    };
    setPos(clampToViewport(def.x, def.y, w, h));
  }, [open, pos, initial, width]);

  // Re-clamp on window resize so it never strands off-screen.
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      setPos((p) => {
        if (!p) return p;
        const w = width;
        const h = panelRef.current?.offsetHeight ?? 320;
        return clampToViewport(p.x, p.y, w, h);
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, width]);

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!pos) return;
      dragState.current = { dx: clientX - pos.x, dy: clientY - pos.y };
    },
    [pos],
  );

  useEffect(() => {
    if (!open) return;
    const onMove = (clientX: number, clientY: number) => {
      if (!dragState.current) return;
      const w = width;
      const h = panelRef.current?.offsetHeight ?? 320;
      const next = clampToViewport(
        clientX - dragState.current.dx,
        clientY - dragState.current.dy,
        w,
        h,
      );
      setPos(next);
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (!dragState.current) return;
      const t = e.touches[0];
      if (t) onMove(t.clientX, t.clientY);
    };
    const stop = () => {
      dragState.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stop);
    };
  }, [open, width]);

  if (!open) return null;

  const left = pos?.x ?? 24;
  const top = pos?.y ?? 24;

  return (
    <div
      ref={panelRef}
      data-testid={testId}
      className="fixed z-40 rounded-2xl border-2 border-amber-200/80 bg-background text-foreground shadow-2xl no-print flex flex-col overflow-hidden"
      style={{ left, top, width, maxHeight: "80vh", pointerEvents: "auto" }}
      role="dialog"
      aria-label={title}
    >
      {/* Title bar — drag handle */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-amber-100/90 dark:bg-amber-900/40 border-b border-amber-200/70 cursor-move select-none"
        onMouseDown={(e) => {
          // ignore drags that start on the control buttons
          if ((e.target as HTMLElement).closest("button")) return;
          startDrag(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          const t = e.touches[0];
          if (t) startDrag(t.clientX, t.clientY);
        }}
      >
        <span className="text-base leading-none">{emoji}</span>
        <span className="font-display text-sm font-semibold flex-1 truncate">{title}</span>
        <button
          type="button"
          onClick={() => setMinimized((m) => !m)}
          className="w-7 h-7 rounded-lg hover:bg-amber-200/70 dark:hover:bg-amber-800/50 flex items-center justify-center text-stone-700 dark:text-amber-100"
          aria-label={minimized ? "Expand" : "Minimize"}
          title={minimized ? "Expand" : "Minimize"}
        >
          {minimized ? "▢" : "—"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-rose-200/80 dark:hover:bg-rose-800/50 flex items-center justify-center text-stone-700 dark:text-amber-100"
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      {!minimized && (
        <div className="overflow-auto p-3" style={{ maxHeight: "calc(80vh - 44px)" }}>
          {children}
        </div>
      )}
    </div>
  );
}
