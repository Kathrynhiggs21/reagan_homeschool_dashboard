/**
 * TodayMomVoiceMemoCard
 *
 * Adult-only widget that surfaces what the system recorded from Mom (Katy)'s
 * 2026-05-17 voice-memo recap of Reagan's completed homeschool work.
 *
 * Why this exists:
 *   - The ingest stamps 23 curriculumTopics with `last_covered_source =
 *     "mom_katy_voice_memo_2026-05-17"`. Without a UI surface, that data
 *     would only be visible via SQL.
 *   - This card lets Mom + Grandma confirm the system heard the memo
 *     correctly, with subject + status + the transcript-quoted evidence
 *     in `notes`.
 *
 * Hide-when-empty: if the source has no rows (cleaned up, future memo,
 * etc.), the card unmounts entirely. No "nothing yet" placeholder.
 *
 * Defense-in-depth: caller mounts under `{unlocked && ...}` (adult lock)
 * AND the procedure is familyAdminProcedure, so a kid client request
 * fails-closed and renders nothing.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const MOM_KATY_SOURCE = "mom_katy_voice_memo_2026-05-17";

type Row = {
  id: number;
  subject: string;
  code: string;
  title: string;
  status: string;
  notes: string | null;
  last_covered_source: string;
  last_covered_at: number | null;
};

function statusBadge(status: string) {
  if (status === "done")
    return (
      <Badge
        variant="outline"
        className="text-[11px] shrink-0 font-semibold border-emerald-500/40 text-emerald-300"
      >
        Done
      </Badge>
    );
  if (status === "inProgress")
    return (
      <Badge
        variant="outline"
        className="text-[11px] shrink-0 font-semibold border-amber-500/40 text-amber-300"
      >
        In progress
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="text-[11px] shrink-0 font-semibold"
    >
      {status}
    </Badge>
  );
}

export default function TodayMomVoiceMemoCard() {
  const q = trpc.curriculum.voiceMemoBackfill.useQuery(
    { source: MOM_KATY_SOURCE, limit: 60 },
    {
      // Read-only spot-check feed; tame stale time and skip refetch noise.
      staleTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  const rows = (q.data ?? []) as Row[];
  if (q.isLoading) return null;
  if (rows.length === 0) return null;

  // Group by subject so the card is scannable.
  const bySubject = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.subject || "Other";
    const arr = bySubject.get(k) || [];
    arr.push(r);
    bySubject.set(k, arr);
  }
  const subjects = Array.from(bySubject.keys()).sort();

  return (
    <Card
      className="classroom-card p-4"
      data-testid="today-mom-voice-memo-card"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-display text-lg font-semibold chalk-white">
          What Mom recapped
        </h2>
        <span className="text-xs text-muted-foreground">
          Voice memo 2026-05-17 · adult view
        </span>
      </div>

      <div className="space-y-3">
        {subjects.map((subj) => {
          const items = bySubject.get(subj) || [];
          return (
            <div key={subj} data-testid={`today-mom-voice-memo-subject-${subj}`}>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {subj} · {items.length}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((r) => (
                  <div
                    key={r.id}
                    className="rounded border bg-card p-2 text-sm"
                    data-testid={`today-mom-voice-memo-item-${r.id}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div
                        className="font-medium leading-snug truncate"
                        title={`${r.code} — ${r.title}`}
                      >
                        <span className="text-muted-foreground mr-1.5">
                          {r.code}
                        </span>
                        {r.title}
                      </div>
                      {statusBadge(r.status)}
                    </div>
                    {r.notes ? (
                      <div
                        className="text-[11px] text-muted-foreground mt-1 line-clamp-2"
                        title={r.notes}
                      >
                        {r.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
