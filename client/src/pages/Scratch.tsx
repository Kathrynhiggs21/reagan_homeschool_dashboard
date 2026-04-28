/**
 * Scratch — blank Apple-Pencil canvas for Reagan to doodle on.
 * - Big draw surface
 * - Save as a Note in TakeNotes when she wants to keep it
 * - Clear button to start over
 */
import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import DrawCanvas, { type DrawCanvasHandle, type PFStroke } from "@/components/DrawCanvas";
import { toast } from "sonner";

export default function Scratch() {
  const canvasRef = useRef<DrawCanvasHandle>(null);
  const [title, setTitle] = useState("");
  const createM = trpc.notes.create.useMutation();

  async function save() {
    const strokes: PFStroke[] = canvasRef.current?.getStrokes() ?? [];
    if (strokes.length === 0) { toast.error("Draw something first."); return; }
    await createM.mutateAsync({
      title: title || `Scratch ${new Date().toLocaleString()}`,
      mode: "draw",
      strokesJson: JSON.stringify(strokes),
    } as any);
    toast.success("Saved to your Notebook.");
    canvasRef.current?.clear();
    setTitle("");
  }

  return (
    <div className="space-y-4">
      <header className="chalkboard">
        <h1 className="font-display text-3xl md:text-4xl chalk-white">Scratch Page</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A blank canvas. Doodle anything — save it to your Notebook if you want to keep it.
        </p>
      </header>
      <Card className="classroom-card p-3 md:p-4">
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="max-w-xs"
          />
          <Button size="sm" onClick={save} disabled={createM.isPending}>💾 Save to Notebook</Button>
          <Button size="sm" variant="outline" className="bg-transparent" onClick={() => canvasRef.current?.clear()}>Clear</Button>
        </div>
        <div className="rounded-lg border border-border overflow-hidden bg-white">
          <DrawCanvas ref={canvasRef} width={1100} height={520} />
        </div>
      </Card>
    </div>
  );
}
