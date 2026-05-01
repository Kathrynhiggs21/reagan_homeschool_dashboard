/**
 * TurnInDialog — Reagan's assignment submission flow.
 *
 * Modes:
 *   1. "reading"  — one-tap ✓ Done reading (skip photo/grade entirely)
 *   2. "draw"     — Apple Pencil over a worksheet image
 *   3. "photo"    — take a photo (rear camera) OR pick from library
 *   4. "typed"    — type answers, auto-graded if an answer key exists
 *
 * Two-step flow:
 *   Step 1: pick mode + provide work
 *   Step 2: "How hard was that for you?" (Easy / Just right / Tricky / Really hard)
 *
 * After turn-in:
 *   - Submission is created (with kidDifficulty + readingCheckmark stored on row)
 *   - For non-reading submissions, we offer a Print this finished work button
 *     so Reagan / Mom can keep a hard copy.
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import DrawCanvas, { type DrawCanvasHandle, type PFStroke } from "@/components/DrawCanvas";
import PrintButton from "@/components/PrintButton";
import TopicLabel from "@/components/TopicLabel";
import { toast } from "sonner";
import { CheckCircle2, BookOpen, Camera, Pencil, Type } from "lucide-react";

export interface TurnInDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  block?: {
    id: number;
    title?: string | null;
    subjectSlug?: string | null;
    /** When true, this assignment is just "read X" — show the simple checkmark mode by default. */
    isReading?: boolean | null;
  };
  /** Optional image URL to use as the drawable background (e.g., worksheet page). */
  worksheetUrl?: string;
}

type Mode = "reading" | "draw" | "photo" | "typed";
type Difficulty = "easy" | "just_right" | "tricky" | "really_hard";
type Step = "compose" | "difficulty" | "done";

const DIFFICULTY_OPTIONS: { value: Difficulty; emoji: string; label: string; tone: string }[] = [
  { value: "easy",        emoji: "😊", label: "Easy",        tone: "bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900" },
  { value: "just_right",  emoji: "🙂", label: "Just right",  tone: "bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-900" },
  { value: "tricky",      emoji: "🤔", label: "Tricky",      tone: "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900" },
  { value: "really_hard", emoji: "😣", label: "Really hard", tone: "bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-900" },
];

export default function TurnInDialog({ open, onOpenChange, block, worksheetUrl }: TurnInDialogProps) {
  const utils = trpc.useUtils();
  const createSub = trpc.submissions.create.useMutation();
  const autoGrade = trpc.submissions.autoGrade.useMutation();
  const uploadM = trpc.submissions.upload.useMutation();

  // If this block looks like reading, default to the reading checkmark mode.
  const looksLikeReading =
    block?.isReading === true ||
    /(^|\s)read(ing)?(\s|$)/i.test(block?.title || "") ||
    block?.subjectSlug === "reading" ||
    block?.subjectSlug === "read_aloud";

  const [step, setStep] = useState<Step>("compose");
  const [mode, setMode] = useState<Mode>(looksLikeReading ? "reading" : "draw");
  const [typedAnswers, setTypedAnswers] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  // Captured submission identity, used in the "done" step for print-finished-work.
  const [lastSubmission, setLastSubmission] = useState<{ id: number; fileUrl?: string } | null>(null);
  const finishedRootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<DrawCanvasHandle>(null);

  // Reset state every time the dialog re-opens for a different block.
  useEffect(() => {
    if (!open) return;
    setStep("compose");
    setMode(looksLikeReading ? "reading" : "draw");
    setTypedAnswers("");
    setPhotoDataUrl(null);
    setDifficulty(null);
    setLastSubmission(null);
  }, [open, block?.id, looksLikeReading]);

  function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  }

  /** Step 1 → Step 2: stash work locally, then ask difficulty. */
  function continueToDifficulty() {
    if (mode === "draw") {
      // Confirm there's actually ink before continuing.
      const strokes = canvasRef.current?.getStrokes() ?? [];
      if (!strokes.length) {
        toast.message("Add at least one stroke or pick another mode.");
        return;
      }
    }
    if (mode === "photo" && !photoDataUrl) {
      toast.message("Take a photo first or switch modes.");
      return;
    }
    if (mode === "typed" && !typedAnswers.trim()) {
      toast.message("Type at least one answer first.");
      return;
    }
    setStep("difficulty");
  }

  async function actuallySubmit(diff: Difficulty) {
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

      const sub: any = await createSub.mutateAsync({
        blockId: block.id,
        mode: mode === "reading" ? "typed" : mode,
        answersText: mode === "typed" ? typedAnswers : undefined,
        strokes: strokes ? (strokes as any) : undefined,
        fileKey,
        fileUrl,
        kidDifficulty: diff,
        readingCheckmark: mode === "reading",
      });

      setLastSubmission({ id: sub?.id, fileUrl });

      // Best-effort auto-grade for non-reading submissions.
      if (mode !== "reading" && sub?.id) {
        try {
          const graded: any = await autoGrade.mutateAsync({ submissionId: sub.id });
          if (graded && graded.autoScore !== null && graded.autoScore !== undefined) {
            toast.success(`Turned in. Auto-score: ${graded.autoScore}/100 (${graded.letter}).`);
          } else {
            toast.success("Turned in.");
          }
        } catch {
          toast.success("Turned in.");
        }
      } else {
        toast.success(mode === "reading" ? "Marked as done reading. Way to go!" : "Turned in.");
      }

      utils.submissions.list.invalidate();
      utils.plans.today.invalidate();
      setStep("done");
    } catch (e: any) {
      toast.error(e?.message || "Turn-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeAndReset() {
    onOpenChange(false);
    setTypedAnswers("");
    setPhotoDataUrl(null);
    setDifficulty(null);
    setStep("compose");
    setLastSubmission(null);
    canvasRef.current?.clear();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) closeAndReset(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {step === "compose" && (mode === "reading" ? `Done reading${block?.title ? ` — ${block.title}` : ""}?` : `Turn in${block?.title ? ` — ${block.title}` : ""}`)}
            {step === "difficulty" && "How hard was that for you?"}
            {step === "done" && "Nice work, Reagan! 🌟"}
          </DialogTitle>
          {block?.subjectSlug && (
            <div className="mt-1">
              <TopicLabel subjectSlug={block.subjectSlug} size="xs" />
            </div>
          )}
        </DialogHeader>

        {/* ---------- STEP 1: compose ---------- */}
        {step === "compose" && (
          <div className="space-y-3">
            {/* Mode picker */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={mode === "reading" ? "default" : "outline"} className="bg-transparent" onClick={() => setMode("reading")}>
                <BookOpen className="w-4 h-4 mr-1.5" /> Done reading
              </Button>
              <Button size="sm" variant={mode === "draw" ? "default" : "outline"} className="bg-transparent" onClick={() => setMode("draw")}>
                <Pencil className="w-4 h-4 mr-1.5" /> Draw on worksheet
              </Button>
              <Button size="sm" variant={mode === "photo" ? "default" : "outline"} className="bg-transparent" onClick={() => setMode("photo")}>
                <Camera className="w-4 h-4 mr-1.5" /> Take photo
              </Button>
              <Button size="sm" variant={mode === "typed" ? "default" : "outline"} className="bg-transparent" onClick={() => setMode("typed")}>
                <Type className="w-4 h-4 mr-1.5" /> Type answers
              </Button>
            </div>

            {mode === "reading" && (
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-900 p-5 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-600" />
                <div className="font-display text-lg font-semibold">All done with this reading?</div>
                <div className="text-sm opacity-80 mt-1">No photo, no test — just tap the check below. Kiwi will save it.</div>
              </div>
            )}

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
                <Label>Take a picture of your finished paper (or pick one)</Label>
                <Input type="file" accept="image/*" capture="environment" onChange={onPhotoPicked} />
                {photoDataUrl && (
                  <img src={photoDataUrl} alt="preview" className="max-h-96 rounded border" />
                )}
                <div className="text-xs text-muted-foreground">
                  Tip: hold your paper flat in good light. We&apos;ll save a clean copy.
                </div>
              </div>
            )}

            {mode === "typed" && (
              <div className="space-y-2">
                <Label>Type your answers (one per line, in order)</Label>
                <Textarea rows={8} value={typedAnswers} onChange={(e) => setTypedAnswers(e.target.value)} />
                <div className="text-xs text-muted-foreground">
                  If there&apos;s an answer key for this block, we&apos;ll auto-grade your typed answers right away.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------- STEP 2: difficulty ---------- */}
        {step === "difficulty" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No wrong answer — just tells Mom + Kiwi how today felt for you.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setDifficulty(opt.value); actuallySubmit(opt.value); }}
                  disabled={submitting}
                  className={`rounded-xl border-2 p-4 text-left transition shadow-sm disabled:opacity-50 ${opt.tone}`}
                >
                  <div className="text-3xl">{opt.emoji}</div>
                  <div className="font-display font-semibold mt-1">{opt.label}</div>
                </button>
              ))}
            </div>
            {submitting && <div className="text-sm text-muted-foreground italic">Saving…</div>}
          </div>
        )}

        {/* ---------- STEP 3: done + print ---------- */}
        {step === "done" && (
          <div ref={finishedRootRef} className="space-y-4">
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-950 p-4">
              <div className="font-display text-lg font-semibold">
                {mode === "reading" ? "📖 Reading marked done!" : "✨ Turned in!"}
              </div>
              <div className="text-sm mt-1">
                {block?.title && <span className="font-semibold">{block.title}</span>}
                {difficulty && (
                  <>
                    {" — "}
                    you said it felt <strong>{DIFFICULTY_OPTIONS.find(d => d.value === difficulty)?.label.toLowerCase()}</strong>{" "}
                    {DIFFICULTY_OPTIONS.find(d => d.value === difficulty)?.emoji}.
                  </>
                )}
              </div>
              {lastSubmission?.fileUrl && (
                <img
                  src={lastSubmission.fileUrl}
                  alt="Finished work"
                  className="mt-3 max-h-72 rounded border border-amber-300 print-only-show"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {mode !== "reading" && (
                <PrintButton
                  targetEl={finishedRootRef.current}
                  label="Print this finished work"
                />
              )}
              <Button variant="outline" onClick={closeAndReset}>Done</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "compose" && (
            <>
              <Button variant="outline" onClick={closeAndReset} disabled={submitting}>Cancel</Button>
              {mode === "reading" ? (
                <Button onClick={() => setStep("difficulty")} disabled={submitting}>
                  ✓ Done reading
                </Button>
              ) : (
                <Button onClick={continueToDifficulty} disabled={submitting}>Next</Button>
              )}
            </>
          )}
          {step === "difficulty" && (
            <Button variant="outline" onClick={() => setStep("compose")} disabled={submitting}>Back</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
