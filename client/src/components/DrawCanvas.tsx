/**
 * DrawCanvas — Apple-Pencil-aware drawing surface using perfect-freehand.
 * Pointer events capture pressure from iPad Apple Pencil automatically;
 * falls back to mouse/touch with a fixed pressure.
 *
 * Usage:
 *   const ref = useRef<DrawCanvasHandle>(null);
 *   <DrawCanvas ref={ref} width={800} height={600} />
 *   // then: ref.current?.toPNG() -> base64 dataURL
 *   //       ref.current?.getStrokes() -> JSON
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";

export interface DrawCanvasHandle {
  clear: () => void;
  undo: () => void;
  getStrokes: () => PFStroke[];
  toPNG: () => string;
  setStrokes: (s: PFStroke[]) => void;
}

export interface PFPoint { x: number; y: number; pressure: number }
export interface PFStroke { points: PFPoint[]; color: string; size: number }

export interface DrawCanvasProps {
  width: number;
  height: number;
  color?: string;
  size?: number;
  background?: string; // optional image/pdf page background (dataURL/URL)
  className?: string;
}

function getSvgPathFromStroke(points: number[][]): string {
  if (!points.length) return "";
  const d = points.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...points[0], "Q"] as any[]
  );
  d.push("Z");
  return d.join(" ");
}

const DrawCanvas = forwardRef<DrawCanvasHandle, DrawCanvasProps>(function DrawCanvas(
  { width, height, color = "#111", size = 4, background, className },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<PFStroke[]>([]);
  const [current, setCurrent] = useState<PFStroke | null>(null);

  // Redraw all strokes onto the canvas whenever they change
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const draw = (s: PFStroke) => {
      const stroke = getStroke(
        s.points.map((p) => [p.x, p.y, p.pressure]),
        { size: s.size, thinning: 0.6, smoothing: 0.5, streamline: 0.5 }
      );
      if (!stroke.length) return;
      const d = getSvgPathFromStroke(stroke);
      const path = new Path2D(d);
      ctx.fillStyle = s.color;
      ctx.fill(path);
    };
    for (const s of strokes) draw(s);
    if (current) draw(current);
  }, [strokes, current]);

  // Render background if provided
  useEffect(() => {
    if (!background) return;
    const c = bgRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
    };
    img.src = background;
  }, [background]);

  useImperativeHandle(ref, () => ({
    clear: () => { setStrokes([]); setCurrent(null); },
    undo: () => setStrokes((s) => s.slice(0, -1)),
    getStrokes: () => strokes,
    setStrokes: (s) => setStrokes(s),
    toPNG: () => {
      const c = canvasRef.current;
      if (!c) return "";
      // Composite bg + strokes for export
      const out = document.createElement("canvas");
      out.width = c.width; out.height = c.height;
      const octx = out.getContext("2d")!;
      octx.fillStyle = "#fff";
      octx.fillRect(0, 0, out.width, out.height);
      const b = bgRef.current;
      if (b) octx.drawImage(b, 0, 0);
      octx.drawImage(c, 0, 0);
      return out.toDataURL("image/png");
    },
  }), [strokes]);

  function addPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    return { x, y, pressure };
  }

  return (
    <div
      className={className}
      style={{ position: "relative", width, height, touchAction: "none" }}
    >
      <canvas
        ref={bgRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          background: background ? "transparent" : "#fff",
          cursor: "crosshair",
          borderRadius: 4,
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setCurrent({ color, size, points: [addPoint(e)] });
        }}
        onPointerMove={(e) => {
          if (!current) return;
          // Support both mouse & Apple Pencil (pointerType==="pen")
          setCurrent({ ...current, points: [...current.points, addPoint(e)] });
        }}
        onPointerUp={() => {
          if (current) {
            setStrokes((s) => [...s, current]);
            setCurrent(null);
          }
        }}
        onPointerCancel={() => setCurrent(null)}
      />
    </div>
  );
});

export default DrawCanvas;
