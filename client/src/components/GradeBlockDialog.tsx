/**
 * GradeBlockDialog — adult-only modal for grading a completed block.
 * Shows a 0-100 slider (precise), auto letter (A/B/C/D/F),
 * and a 4-button kid-friendly label ("Not yet" / "Getting there" / "Got it" / "Mastered").
 * Only the kid-friendly label is shown to Reagan — letter + numeric grades stay adult-only.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type KidLabel = "not_yet" | "getting_there" | "got_it" | "mastered";

const KID_LABELS: { value: KidLabel; label: string; min: number }[] = [
  { value: "not_yet",        label: "Not yet",       min: 0 },
  { value: "getting_there",  label: "Getting there", min: 50 },
  { value: "got_it",         label: "Got it",        min: 75 },
  { value: "mastered",       label: "Mastered",      min: 90 },
];

function scoreToLetter(s: number): string {
  if (s >= 90) return "A";
  if (s >= 80) return "B";
  if (s >= 70) return "C";
  if (s >= 60) return "D";
  return "F";
}

export interface GradeBlockDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  block?: { id: number; title?: string | null; subjectSlug?: string | null };
}

export default function GradeBlockDialog({ open, onOpenChange, block }: GradeBlockDialogProps) {
  const utils = trpc.useUtils();
  const existing = trpc.grades.get.useQuery(
    { blockId: block?.id || 0 },
    { enabled: !!block?.id && open }
  );
  const upsertM = trpc.grades.upsert.useMutation();

  const [score, setScore] = useState(85);
  const [kidLabel, setKidLabel] = useState<KidLabel>("got_it");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open && existing.data) {
      setScore(existing.data.score ?? 85);
      setKidLabel((existing.data.kidLabel as KidLabel) ?? "got_it");
      setNote(existing.data.note ?? "");
    } else if (open) {
      setScore(85);
      setKidLabel("got_it");
      setNote("");
    }
  }, [open, existing.data?.id]);

  async function save() {
    if (!block?.id) return;
    try {
      await upsertM.mutateAsync({
        blockId: block.id,
        subjectSlug: block.subjectSlug ?? undefined,
        score,
        letter: scoreToLetter(score),
        kidLabel,
        note: note || undefined,
      });
      utils.grades.listAll.invalidate();
      utils.grades.rolling.invalidate();
      toast.success("Grade saved.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Save failed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grade block{block?.title ? ` — ${block.title}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <div className="flex items-baseline justify-between">
              <Label>Score (adult-only)</Label>
              <div className="text-base font-mono">
                {score}<span className="text-muted-foreground"> / 100</span>
                <span className="ml-2 px-2 py-0.5 rounded border bg-white/10">{scoreToLetter(score)}</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(parseInt(e.target.value))}
              className="w-full mt-2"
            />
          </div>

          <div>
            <Label>Kid-facing label (what Reagan sees)</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {KID_LABELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => { setKidLabel(l.value); setScore(Math.max(score, l.min)); }}
                  className={`px-3 py-2 rounded border text-xs ${
                    kidLabel === l.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white/5 border-border"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Reagan only sees the friendly label — never the number or letter.
            </div>
          </div>

          <div>
            <Label>Adult note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save grade</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
