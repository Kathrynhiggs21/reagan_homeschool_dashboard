/**
 * AnswerKeyDialog — adult-only.
 * Manage the answer key for a schedule block (multiple-choice, short-text, drawn).
 * - Free-form add/remove rows
 * - Total points editable (default 100)
 * - Save persists via trpc.answerKeys.upsert
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Q {
  id: string;
  type: "mc" | "text" | "drawn";
  prompt: string;
  answer: string;       // for mc: A/B/C/D; for text/drawn: the expected wording
  points: number;
}

export default function AnswerKeyDialog({
  open, onOpenChange, blockId, blockTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  blockId: number | null;
  blockTitle?: string;
}) {
  const utils = trpc.useUtils();
  const existing = trpc.answerKeys.get.useQuery(
    { blockId: blockId ?? 0 },
    { enabled: !!blockId && open }
  );
  const upsertM = trpc.answerKeys.upsert.useMutation();

  const [questions, setQuestions] = useState<Q[]>([]);
  const [totalPoints, setTotalPoints] = useState(100);

  useEffect(() => {
    if (!open) return;
    if (existing.data && (existing.data as any).questions) {
      const qs = (existing.data as any).questions as any[];
      setQuestions(qs.map((q, i) => ({
        id: String(q.id ?? i),
        type: (q.type as any) || "text",
        prompt: q.prompt || "",
        answer: q.answer || "",
        points: q.points ?? Math.round(100 / Math.max(qs.length, 1)),
      })));
      setTotalPoints((existing.data as any).totalPoints ?? 100);
    } else if (existing.isFetched) {
      setQuestions([]);
      setTotalPoints(100);
    }
  }, [open, existing.data, existing.isFetched]);

  function add(type: Q["type"]) {
    setQuestions((qs) => [
      ...qs,
      { id: String(Date.now() + Math.random()), type, prompt: "", answer: "", points: 10 },
    ]);
  }
  function update(id: string, patch: Partial<Q>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function remove(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }

  async function save() {
    if (!blockId) return;
    if (questions.length === 0) { toast.error("Add at least one question."); return; }
    await upsertM.mutateAsync({
      blockId,
      questions: questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, answer: q.answer, points: q.points })),
      totalPoints,
    });
    utils.answerKeys.get.invalidate({ blockId });
    toast.success("Answer key saved.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Answer key {blockTitle ? `— ${blockTitle}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <Label className="text-xs">Total points</Label>
            <Input
              type="number"
              className="w-24"
              value={totalPoints}
              onChange={(e) => setTotalPoints(Number(e.target.value) || 100)}
            />
            <div className="text-xs text-muted-foreground">
              Auto-grading uses this as the denominator. Per-question points sum {questions.reduce((s, q) => s + (q.points || 0), 0)}.
            </div>
          </div>

          {questions.length === 0 && (
            <div className="text-xs text-muted-foreground border border-dashed rounded p-3">
              No questions yet. Add one to enable auto-grading on Reagan's submission.
            </div>
          )}

          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={q.id} className="border border-border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">Q{idx + 1}</div>
                  <div className="flex items-center gap-2">
                    <Select value={q.type} onValueChange={(v) => update(q.id, { type: v as Q["type"] })}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mc">Multiple choice</SelectItem>
                        <SelectItem value="text">Short answer</SelectItem>
                        <SelectItem value="drawn">Drawn / image</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-16 h-7 text-xs"
                      value={q.points}
                      onChange={(e) => update(q.id, { points: Number(e.target.value) || 0 })}
                    />
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => remove(q.id)}>🗑</Button>
                  </div>
                </div>
                <Input
                  placeholder="Question prompt (e.g., 1/2 + 1/4 = ?)"
                  value={q.prompt}
                  onChange={(e) => update(q.id, { prompt: e.target.value })}
                />
                <Input
                  placeholder={
                    q.type === "mc" ? 'Correct answer (A, B, C, D, etc.)'
                    : q.type === "text" ? 'Expected answer (e.g., "3/4")'
                    : 'Expected answer the LLM should look for in the drawing (e.g., "3/4")'
                  }
                  value={q.answer}
                  onChange={(e) => update(q.id, { answer: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="bg-transparent" onClick={() => add("mc")}>+ MC</Button>
            <Button size="sm" variant="outline" className="bg-transparent" onClick={() => add("text")}>+ Short answer</Button>
            <Button size="sm" variant="outline" className="bg-transparent" onClick={() => add("drawn")}>+ Drawn</Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={upsertM.isPending}>Save key</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
