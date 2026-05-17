/**
 * TodayForwardPlanCard — Push 2.10 (2026-05-17)
 *
 * Adult-only widget that lets Mom Katy + Grandma Marcy preview the next
 * two weeks of school based on the *actual* curriculum gap (the topics
 * still inProgress / notStarted), then commit it with one click.
 *
 *   - PreviewQuery is auto-fetched on mount (familyAdmin gated server-side).
 *   - "Apply" mutation creates schedule blocks (idempotent — safe to re-click).
 *   - Hides itself entirely when the proposed plan is empty.
 *   - Reagan never sees this: it lives behind `{unlocked && ...}` on Today.
 *
 * Visual: grouped by date, with a sparkle badge on transcript-flagged
 * blocker rows (Math final test, more multiplying, SEL anxiety triggers,
 * finish Michael's World, Science Unit 4 Matter).
 */

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type PreviewRow = {
  date: string;
  weekday: number;
  slotIndex: number;
  subject: string;
  topicId: number;
  code: string;
  title: string;
  evidence: string | null;
  isBlockerFrontload: boolean;
};

const SUBJECT_EMOJI: Record<string, string> = {
  Math: "🔢",
  ELA: "📖",
  Science: "🔬",
  Social: "🌍",
  Specials: "🎨",
};

function fmtDate(iso: string): string {
  // Local-tz friendly: "Mon · May 18"
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function TodayForwardPlanCard() {
  const [horizon] = useState(10);
  const utils = trpc.useUtils();
  const preview = trpc.curriculum.forwardPlan.preview.useQuery(
    { horizonDays: horizon },
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  const apply = trpc.curriculum.forwardPlan.applyPlan.useMutation({
    onSuccess: (res) => {
      const created = res?.created ?? 0;
      const skipped = res?.skipped ?? 0;
      toast.success(
        `Plan applied — created ${created} block${created === 1 ? "" : "s"}` +
          (skipped > 0 ? `, skipped ${skipped} (already on the calendar)` : ""),
      );
      // Surface effect immediately on the schedule + Today blocks.
      utils.curriculum.forwardPlan.preview.invalidate();
    },
    onError: (e) => toast.error(e.message || "Couldn't apply plan"),
  });

  const rows = (preview.data?.rows ?? []) as PreviewRow[];
  const perSubject = preview.data?.perSubject ?? {};

  const byDate = useMemo(() => {
    const map = new Map<string, PreviewRow[]>();
    for (const r of rows) {
      const arr = map.get(r.date) || [];
      arr.push(r);
      map.set(r.date, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [rows]);

  if (preview.isLoading) return null;
  if (rows.length === 0) return null;

  return (
    <Card
      className="classroom-card p-4"
      data-testid="today-forward-plan-card"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="font-display text-lg font-semibold chalk-white">
            Plan the next 2 weeks
          </h2>
          <p className="text-xs text-muted-foreground">
            Based on what Reagan still hasn't finished. ✨ = transcript-flagged
            blocker (front-loaded into the first 3 school days).
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => apply.mutate({ rows, source: "forward_planner_2026-05-17" })}
          disabled={apply.isPending}
          data-testid="today-forward-plan-apply"
        >
          {apply.isPending ? "Applying…" : `Apply (${rows.length} blocks)`}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {Object.entries(perSubject).map(([subj, n]) => (
          <Badge
            key={subj}
            variant="outline"
            className="text-[11px] font-semibold"
          >
            {SUBJECT_EMOJI[subj] ?? "✨"} {subj} · {n}
          </Badge>
        ))}
      </div>

      <div className="space-y-3">
        {byDate.map(([date, dayRows]) => (
          <div
            key={date}
            data-testid={`today-forward-plan-day-${date}`}
            className="rounded-lg border border-border/50 p-2"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {fmtDate(date)}
            </div>
            <div className="space-y-1">
              {dayRows.map((r) => (
                <div
                  key={`${r.date}-${r.topicId}`}
                  className="flex items-baseline gap-2 text-sm"
                  data-testid={`today-forward-plan-row-${r.topicId}`}
                >
                  <span className="text-xs">{SUBJECT_EMOJI[r.subject] ?? "✨"}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {r.code}
                  </span>
                  <span className="chalk-white">{r.title}</span>
                  {r.isBlockerFrontload && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-500/40 text-amber-300"
                    >
                      ✨ Blocker
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
