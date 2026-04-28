/**
 * TurnInDialog — Reagan's assignment submission flow.
 *
 * Supports three input modes:
 *   1. Drawn-on worksheet (Apple Pencil via DrawCanvas over image background)
 *   2. Photo upload (mom takes a picture of paper worksheet)
 *   3. Typed answers (for MC/text answer keys) — auto-graded on submit
 *
 * On submit:
 *   - uploads composite PNG to storage (server procedure)
 *   - creates an assignmentSubmission row
 *   - triggers server-side auto-grading if an answerKey exists for this block
 */
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import DrawCanvas, { type DrawCanvasHandle, type PFStroke } from "@/components/DrawCanvas";
import { toast } from "sonner";

export interface TurnInDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  block?: { id: number; title?: string | null; subjectSlug?: string | null };
  /** Optional image URL to use as the drawable background (e.g., worksheet page). */
  worksheetUrl?: string;
}

type Mode = "draw" | "photo" | "typed";

export default function TurnInDialog({ open, onOpenChange, block, worksheetUrl }: TurnInDialogProps) {
  const utils = trpc.useUtils();
  const createSub = trpc.submissions.create.useMutation();
  const autoGrade = trpc.submissions.autoGrade.useMutation();
  const uploadM = trpc.submissions.upload.useMutation();

  const [mode, setMode] = useState<Mode>("draw");
  const [typedAnswers, setTypedAnswers] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef<DrawCanvasHandle>(null);

  function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (!block?.id) return;
    setSubmitting(true);
    try {
      let pngDataUrl: string | null = null;
      let strokes: PFStroke[] | null = null;
      if (mode === "draw") {
        strokes = canvasRef.current?.getStrokes() ?? [];
        pngDataUrl = canvasRef.current?.toPNG() ?? null;
      } else if (mode === "photo") {
        pngDataUrl = photoDataUrl;
      }

      let fileKey: string | undefined;
      let fileUrl: string | undefined;
      if (pngDataUrl) {
        const up = await uploadM.mutateAsync({
          dataUrl: pngDataUrl,
          fileName: `assignment-${block.id}-${Date.now()}.png`,
        });
        fileKey = (up as any)?.key;
        fileUrl = (up as any)?.url;
      }

      const sub = await createSub.mutateAsync({
        blockId: block.id,
        mode,
        answersText: mode === "typed" ? typedAnswers : undefined,
        strokes: strokes ? (strokes as any) : undefined,
        fileKey,
        fileUrl,
      });

      // Try auto-grade
      const graded = await autoGrade.mutateAsync({ submissionId: (sub as any)?.id }).catch(() => null);
      if (graded && (graded as any).autoScore !== null) {
        toast.success(`Turned in. Auto-score: ${(graded as any).autoScore} / 100 (${(graded as any).letter}).`);
      } else {
        toast.success("Turned in.");
      }

      utils.submissions.list.invalidate();
      utils.plans.today.invalidate();
      onOpenChange(false);
      // Reset
      setTypedAnswers("");
      setPhotoDataUrl(null);
      canvasRef.current?.clear();
    } catch (e: any) {
      toast.error(e?.message || "Turn-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Turn in{block?.title ? ` — ${block.title}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            {(["draw", "photo", "typed"] as Mode[]).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? "default" : "outline"}
                className="bg-transparent"
                onClick={() => setMode(m)}
              >
                {m === "draw" ? "Draw on worksheet" : m === "photo" ? "Upload photo" : "Type answers"}
              </Button>
            ))}
          </div>

          {mode === "draw" && (
            <div>
              <div className="border rounded overflow-hidden" style={{ background: "#f6f3ea" }}>
                <DrawCanvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  color="#111"
                  size={3}
                  background={worksheetUrl || undefined}
                  className="mx-auto"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => canvasRef.current?.undo()}>Undo</Button>
                <Button size="sm" variant="ghost" onClick={() => canvasRef.current?.clear()}>Clear</Button>
                <div className="text-xs text-muted-foreground self-center">Apple Pencil works great — pressure-aware strokes.</div>
              </div>
            </div>
          )}

          {mode === "photo" && (
            <div className="space-y-2">
              <Label>Upload a photo of your completed paper</Label>
              <Input type="file" accept="image/*" capture="environment" onChange={onPhotoPicked} />
              {photoDataUrl && (
                <img src={photoDataUrl} alt="preview" className="max-h-96 rounded border" />
              )}
            </div>
          )}

          {mode === "typed" && (
            <div className="space-y-2">
              <Label>Type your answers (one per line, in order)</Label>
              <Textarea rows={8} value={typedAnswers} onChange={(e) => setTypedAnswers(e.target.value)} />
              <div className="text-xs text-muted-foreground">
                If there's an answer key for this block, we'll auto-grade your typed answers right away.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Turning in..." : "Turn in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
