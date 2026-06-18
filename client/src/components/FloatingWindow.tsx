import { useCallback, useEffect, useRef, useState } from "react";

/**
 * FloatingWindow — a draggable, RESIZABLE, non-blocking floating panel.
 *
 * 2026-06-18 (Katy): Reagan's dock tools (Notebook / Timer / Calculator / Word)
 * used to open as blocking modal Dialogs — opening one dimmed the page and you
 * couldn't use the site behind it, and switching pages closed the tool. This
 * component fixes both: it renders OUTSIDE any backdrop, can be dragged around
 * by its title bar, and stays mounted while Reagan navigates the rest of the
 * site (the dock owns the open/closed state, not a route).
 *
 * 2026-06-18 (Katy, follow-up): each window is now also resizable via a corner
 * grip in the bottom-right — drag it to make the tool bigger or smaller. Size is
 * clamped to a sane min/max and to the viewport. Works with mouse and touch.
 *
 * Intentionally framework-light: no portal, no focus trap, no backdrop. It's a
 * positioned panel that floats above the page (z-40, below Kiwi's z-50) and
 * never steals interaction from the page underneath.
 *
 * Behaviour:
 *   • Drag by the header to reposition. Position is clamped to the viewport so
 *     it can never be dragged fully off-screen.
 *   • Drag the bottom-right grip to resize (width + height).
 *   • Minimize collapses to just the title bar (keeps state + size alive).
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
  /** Initial content width in px (user can resize from here). */
  width?: number;
  /** Initial content height in px (defaults to a comfortable size). */
  height?: number;
  /** Minimum size when resizing. */
  minWidth?: number;
  minHeight?: number;
  /** data-testid passthrough for contract tests. */
  testId?: string;
}

const TITLE_BAR_H = 44;

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
  height = 420,
  minWidth = 260,
  minHeight = 220,
  testId,
}: FloatingWindowProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: width, h: height });
  const [minimized, setMinimized] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ dx: number; dy: number } | null>(null);
  const resizeState = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  // Pick an initial position the first time the window opens (or on resize if
  // it would land off-screen). Default: lower-left, clear of the dock.
  useEffect(() => {
    if (!open) return;
    if (pos) return;
    const w = size.w;
    const h = size.h + TITLE_BAR_H;
    const def = initial ?? {
      x: 24,
      y: Math.max(24, window.innerHeight - h - 110),
    };
    setPos(clampToViewport(def.x, def.y, w, h));
  }, [open, pos, initial, size.w, size.h]);

  // Re-clamp position on window resize so it never strands off-screen.
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      setPos((p) => {
        if (!p) return p;
        return clampToViewport(p.x, p.y, size.w, size.h + TITLE_BAR_H);
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, size.w, size.h]);

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!pos) return;
      dragState.current = { dx: clientX - pos.x, dy: clientY - pos.y };
    },
    [pos],
  );

  const startResize = useCallback(
    (clientX: number, clientY: number) => {
      resizeState.current = {
        startX: clientX,
        startY: clientY,
        startW: size.w,
        startH: size.h,
      };
    },
    [size.w, size.h],
  );

  // Global move/end listeners handle BOTH dragging and resizing.
  useEffect(() => {
    if (!open) return;
    const onMove = (clientX: number, clientY: number) => {
      // Resizing takes precedence if active.
      if (resizeState.current) {
        const rs = resizeState.current;
        const dw = clientX - rs.startX;
        const dh = clientY - rs.startY;
        const originX = pos?.x ?? 24;
        const originY = pos?.y ?? 24;
        const maxW = Math.max(minWidth, window.innerWidth - originX - 16);
        const maxH = Math.max(minHeight, window.innerHeight - originY - TITLE_BAR_H - 16);
        const nextW = Math.min(maxW, Math.max(minWidth, rs.startW + dw));
        const nextH = Math.min(maxH, Math.max(minHeight, rs.startH + dh));
        setSize({ w: nextW, h: nextH });
        return;
      }
      if (dragState.current) {
        const next = clampToViewport(
          clientX - dragState.current.dx,
          clientY - dragState.current.dy,
          size.w,
          size.h + TITLE_BAR_H,
        );
        setPos(next);
      }
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) onMove(t.clientX, t.clientY);
    };
    const stop = () => {
      dragState.current = null;
      resizeState.current = null;
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
  }, [open, size.w, size.h, pos, minWidth, minHeight]);

  if (!open) return null;

  const left = pos?.x ?? 24;
  const top = pos?.y ?? 24;

  return (
    <div
      ref={panelRef}
      data-testid={testId}
      className="fixed z-40 rounded-2xl border-2 border-amber-200/80 bg-background text-foreground shadow-2xl no-print flex flex-col overflow-hidden"
      style={{ left, top, width: size.w, pointerEvents: "auto" }}
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

      {/* Body — fills the resized height */}
      {!minimized && (
        <div className="overflow-auto p-3 relative" style={{ height: size.h }}>
          {children}
          {/* Resize grip (bottom-right corner) */}
          <div
            data-testid={testId ? `${testId}-resize` : undefined}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end text-stone-400 dark:text-amber-200/70 select-none touch-none"
            aria-label="Resize"
            title="Drag to resize"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startResize(e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) {
                e.stopPropagation();
                startResize(t.clientX, t.clientY);
              }
            }}
          >
            {/* simple corner grip glyph */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M13 5L5 13M13 9L9 13M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
