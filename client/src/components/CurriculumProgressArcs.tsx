import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { subjectMeta } from "@/components/TopicLabel";

/**
 * CurriculumProgressArcs
 *
 * Adult-only panel: one circular progress arc per subject (Math, ELA, Science,
 * Social, Specials), driven by curriculum.progress, plus a compact list of
 * recent submissions (curriculum.recent) so adults can see what's actually
 * landing on the tree week-over-week.
 */

const SUBJECT_TO_SLUG: Record<string, string> = {
  Math: "math",
  ELA: "ela",
  Science: "science",
  Social: "ss",
  Specials: "art",
};

function ProgressArc({ value, color }: { value: number; color: string }) {
  // SVG circular arc, stroke-dasharray approach; 110×110, r=46.
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const off = c - (c * pct) / 100;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" aria-label={`${pct}% complete`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle
        cx="55" cy="55" r={r} fill="none"
        stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off}
        transform="rotate(-90 55 55)"
      />
      <text x="55" y="62" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

export default function CurriculumProgressArcs() {
  const progress = trpc.curriculum.progress.useQuery();
  const recent = trpc.curriculum.recent.useQuery({ limit: 15 });

  const rows: any[] = (progress.data as any[]) ?? [];
  const recentRows: any[] = (recent.data as any[]) ?? [];

  return (
    <Card className="cozy-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-lg">Per-topic progress</h2>
          <p className="text-xs text-muted-foreground">
            Each arc shows how many curriculum topics in that subject are marked done.
            Topics auto-flip to "in progress" when Reagan turns work in.
          </p>
        </div>
      </div>

      {progress.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!progress.isLoading && rows.length === 0 && (
        <div className="text-sm text-muted-foreground italic">
          No curriculum rows seeded yet. Click "Seed curriculum" in the Topics Tree above.
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {rows.map((r) => {
            const slug = SUBJECT_TO_SLUG[r.subject] ?? "math";
            const meta = subjectMeta(slug);
            return (
              <div key={r.subject} className="rounded-xl border bg-white/60 dark:bg-white/5 p-3 flex flex-col items-center" style={{ borderColor: `${meta.color}55` }}>
                <ProgressArc value={r.pct} color={meta.color} />
                <div className="mt-2 text-sm font-semibold flex items-center gap-1" style={{ color: meta.color }}>
                  <span aria-hidden>{meta.emoji}</span>
                  {r.subject}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {r.done} / {r.total} topics
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecentTurnInsTable />
    </Card>
  );
}

/**
 * RecentTurnInsTable
 *
 * Mom asked May 2026 to:
 *   - reset the existing recents stream and start clean,
 *   - keep the visible list tiny (5 rows in a scrollable mini-table),
 *   - have a search bar above it that searches EVERY turn-in (not just
 *     the visible 5),
 *   - AI-grade every turn-in to the best of its ability.
 *
 * Continuous Drive sync mirrors the same data into Reagan School Hub /
 * Finished Work, so this table doesn't need a separate Drive button.
 */
function RecentTurnInsTable() {
  const utils = trpc.useUtils();
  const recent = trpc.submissions.recent.useQuery({ limit: 5 });
  const [q, setQ] = useState("");
  const search = trpc.submissions.searchAll.useQuery(
    { q, limit: 25 },
    { enabled: q.trim().length >= 2 },
  );
  const ungradedQ = trpc.submissions.listUngraded.useQuery({ limit: 50 });
  const archive = trpc.submissions.archiveAllRecents.useMutation({
    onSuccess: (r) => {
      toast.success(`Archived ${r.archived} turn-ins. Search still finds them.`);
      utils.submissions.recent.invalidate();
      utils.submissions.searchAll.invalidate();
    },
  });
  const gradeAll = trpc.submissions.gradeAllUngraded.useMutation({
    onSuccess: (r) => {
      toast.success(`AI graded ${r.graded} of ${r.total} (skipped ${r.skipped}, failed ${r.failed}).`);
      utils.submissions.recent.invalidate();
      utils.submissions.listUngraded.invalidate();
    },
    onError: (e) => toast.error(`Grader hiccup: ${e.message}`),
  });

  const showRows: any[] = useMemo(() => {
    if (q.trim().length >= 2) return (search.data as any[]) ?? [];
    // Hide archived rows from the recents-only view.
    return ((recent.data as any[]) ?? []).filter((r) => !String(r.adultNotes || "").includes("archived=1"));
  }, [q, recent.data, search.data]);

  const ungradedCount = ((ungradedQ.data as any[]) ?? []).length;

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="font-semibold text-sm">Recent turn-ins</div>
        <span className="text-[10px] text-muted-foreground">(showing 5; search hits all)</span>
        <div className="ml-auto flex items-center gap-1">
          {ungradedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => gradeAll.mutate({ max: 20 })}
              disabled={gradeAll.isPending}
            >
              🤖 AI grade {ungradedCount}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (window.confirm("Archive every recent turn-in? They stay searchable forever; the visible list resets.")) {
                archive.mutate();
              }
            }}
            disabled={archive.isPending}
          >
            Reset
          </Button>
        </div>
      </div>

      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search every turn-in (title, answers, subject, notes)…"
        className="h-8 text-xs"
        aria-label="Search every turn-in"
      />

      <div className="rounded-md border bg-white/60 dark:bg-white/5 max-h-[220px] overflow-y-auto">
        {(recent.isLoading || (q.trim().length >= 2 && search.isLoading)) ? (
          <div className="p-2 text-xs text-muted-foreground">Loading…</div>
        ) : showRows.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground italic">
            {q.trim().length >= 2 ? "No turn-ins match that search." : "No turn-ins yet."}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background/95 backdrop-blur">
              <tr className="text-left text-[10px] uppercase text-muted-foreground">
                <th className="px-2 py-1">Subject</th>
                <th className="px-2 py-1">Title</th>
                <th className="px-2 py-1">Grade</th>
                <th className="px-2 py-1 tabular-nums">When</th>
              </tr>
            </thead>
            <tbody>
              {showRows.map((r) => {
                const meta = subjectMeta(r.subjectSlug || "");
                const when = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "");
                const score = r.autoScore != null ? `${r.autoLetter || ""} ${r.autoScore}` : (r.readingOnly ? "✓ read" : "—");
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: meta.color }} aria-hidden />
                      <span style={{ color: meta.color }} className="font-semibold">{meta.label}</span>
                    </td>
                    <td className="px-2 py-1 max-w-[260px] truncate">{r.title || "(untitled)"}</td>
                    <td className="px-2 py-1 whitespace-nowrap tabular-nums">{score}</td>
                    <td className="px-2 py-1 whitespace-nowrap tabular-nums opacity-70">{when}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Continuous Drive sync mirrors every turn-in into <span className="font-mono">Reagan School Hub / Finished Work</span> automatically.
      </p>
    </div>
  );
}
