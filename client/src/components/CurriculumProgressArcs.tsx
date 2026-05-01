import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
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

      <div className="border-t pt-3">
        <div className="font-semibold text-sm mb-2">Recent turn-ins</div>
        {recent.isLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : recentRows.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No turn-ins yet.</div>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {recentRows.map((r) => {
              const meta = subjectMeta(r.subjectSlug);
              const when = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "";
              return (
                <li key={r.id} className="flex items-center gap-2 py-0.5">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: meta.color }} aria-hidden />
                  <span style={{ color: meta.color }} className="font-semibold">{meta.label}</span>
                  <span className="opacity-50">·</span>
                  <span className="flex-1 truncate">{r.title}</span>
                  {r.readingOnly && <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-800">📖 read</span>}
                  {r.kidDifficulty && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-800">{r.kidDifficulty.replace("_"," ")}</span>
                  )}
                  <span className="opacity-60 tabular-nums">{when}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
