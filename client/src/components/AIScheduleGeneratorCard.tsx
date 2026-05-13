import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DescriptionWithLinks } from "@/components/DescriptionWithLinks";

/**
 * Adult-only card on Today: ask Kiwi to draft a schedule for a date.
 * Two-step: (1) generate draft preview, (2) commit to plans.
 */
export default function AIScheduleGeneratorCard({ defaultDate }: { defaultDate: string }) {
  const utils = trpc.useUtils();
  const [date, setDate] = useState<string>(defaultDate);
  const [dayLength, setDayLength] = useState<"full" | "half" | "off">("full");
  const [adultPrompt, setAdultPrompt] = useState<string>("");
  const [draft, setDraft] = useState<{ summary: string; warnings: string[]; blocks: any[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [seedTopicId, setSeedTopicId] = useState<number | null>(null);

  // Listen for cross-component requests (e.g. TopicDrawer's "Plan a daily
  // assignment" button) to seed the generator with a specific curriculum topic.
  useEffect(() => {
    function onSeed(e: Event) {
      const detail: any = (e as CustomEvent).detail;
      if (!detail) return;
      const code = detail.code ? `${detail.code} ` : "";
      const title = detail.title ? `${detail.title}` : "";
      const focus = `Seed this topic into today's plan: ${code}${title}. Build 2-3 short, hands-on or screen-light blocks (e.g. a video, a worksheet, and an outdoor or whiteboard practice).`;
      setAdultPrompt(focus);
      if (detail.topicId && typeof detail.topicId === "number") setSeedTopicId(detail.topicId);
      // Auto-trigger draft.
      const targetDate = detail.date || date || defaultDate;
      if (targetDate) {
        setDate(targetDate);
        generate.mutate({ date: targetDate, dayLength, adultPrompt: focus, allowWeekend: true });
      }
    }
    window.addEventListener("kiwi:seed-topic", onSeed as any);
    return () => window.removeEventListener("kiwi:seed-topic", onSeed as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = trpc.plans.aiGenerate.useMutation({
    onSuccess: (d) => { setDraft(d as any); setOpen(true); },
    onError: (e) => toast.error("Kiwi couldn't draft a plan: " + e.message),
  });
  const commit = trpc.plans.aiCommit.useMutation({
    onSuccess: ({ blockCount }) => {
      toast.success(`Saved ${blockCount} block(s) for ${date}.`);
      setOpen(false);
      setDraft(null);
      utils.plans.invalidate();
      utils.blocks.invalidate();
    },
    onError: (e) => toast.error("Save failed: " + e.message),
  });

  return (
    <Card className="classroom-card p-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-sm font-semibold chalk-white">🪄 AI schedule generator</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Ask Kiwi to draft a day. You'll preview before anything saves.
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-input bg-transparent px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Length</span>
          <select
            value={dayLength}
            onChange={(e) => setDayLength(e.target.value as any)}
            className="rounded-md border border-input bg-transparent px-2 py-1 text-sm"
          >
            <option value="full">Full day (~3–4 hrs)</option>
            <option value="half">Half day (~1.5–2.5 hrs)</option>
            <option value="off">Rest day</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button
            size="sm"
            className="w-full"
            disabled={generate.isPending || !date}
            onClick={() => generate.mutate({ date, dayLength, adultPrompt: adultPrompt.trim() || undefined })}
          >
            {generate.isPending ? "Drafting…" : "Draft with Kiwi"}
          </Button>
        </div>
      </div>

      <div className="mt-2">
        <Textarea
          placeholder="Optional focus: e.g. 'half day, planets video + worksheet, math on triangles & angles'"
          value={adultPrompt}
          onChange={(e) => setAdultPrompt(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview — {date}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              {draft.summary && (
                <div className="text-sm text-muted-foreground italic">{draft.summary}</div>
              )}
              {draft.warnings.length > 0 && (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs">
                  <div className="font-semibold mb-1">Warnings ({draft.warnings.length})</div>
                  <ul className="list-disc pl-5">
                    {draft.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {draft.blocks.map((b, i) => (
                  <div key={i} className="rounded-md border border-border/50 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold text-sm">{b.title}</div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {b.startTime ? `${b.startTime} · ` : ""}{b.durationMin}m
                        {b.subjectSlug ? ` · ${b.subjectSlug}` : ""}
                      </div>
                    </div>
                    {b.description && <DescriptionWithLinks text={b.description} className="text-xs mt-1 whitespace-pre-wrap" />}
                  </div>
                ))}
                {draft.blocks.length === 0 && (
                  <div className="text-sm text-muted-foreground">Kiwi didn't return any usable blocks. Try again with more specific guidance.</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="ghost" onClick={() => setOpen(false)}>Discard</Button>
            <Button
              variant="outline"
              className="bg-transparent"
              onClick={() => generate.mutate({ date, dayLength, adultPrompt: adultPrompt.trim() || undefined })}
              disabled={generate.isPending}
            >
              {generate.isPending ? "…" : "Re-draft"}
            </Button>
            <Button
              disabled={commit.isPending || !draft || draft.blocks.length === 0}
              onClick={() => draft && commit.mutate({
                date,
                dayLength,
                summary: draft.summary,
                replaceExisting: true,
                blocks: draft.blocks,
                seedTopicId: seedTopicId ?? undefined,
              })}
            >
              {commit.isPending ? "Saving…" : `Replace ${date} with these blocks`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
