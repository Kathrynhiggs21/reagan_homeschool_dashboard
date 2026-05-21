import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SubjectColorKey from "@/components/SubjectColorKey";
import CurriculumTopicsTree from "@/components/CurriculumTopicsTree";
// v2.41 (2026-05-18) — CurriculumProgressArcs moved off Curriculum Hub onto
// the Analytics page (per todo line 361). The component itself is preserved
// at /components/CurriculumProgressArcs.tsx and is now mounted on /analytics
// next to CurriculumCoverageArcs.
import OwnedBookCard from "@/components/OwnedBookCard";
import IepReferencePanel from "@/components/IepReferencePanel";
import { subjectTint, tintCardStyle, tintInkStyle } from "@/lib/subjectColors";

export default function Curriculum() {
  const subjects = trpc.subjects.list.useQuery();
  const skills = trpc.skills.list.useQuery();
  const books = trpc.books.list.useQuery();
  const adjustments = trpc.adjustments.list.useQuery({});
  const subjectGrades = trpc.submissions.subjectGrades.useQuery();
  const decideM = trpc.adjustments.decide.useMutation();
  const rebuildM = trpc.adjustments.rebuild.useMutation();
  const syncFutureDays = trpc.curriculum.syncFutureDays.useMutation();
  // Push 37 (2026-05-13): pinned "Tomorrow's draft" strip so Mom can see
  // overnight if the 9 PM cron actually committed the next school day's
  // blocks. Soft-fail (any) so a missing procedure on stale clients
  // doesn't break the page.
  const tomorrowPreview = (trpc as any).curriculum?.tomorrowPreview?.useQuery?.() ?? { data: null, isLoading: false };
  const utils = trpc.useUtils();

  const proposed = ((adjustments.data as any[]) ?? []).filter((a) => a.status === "proposed");

  async function decide(id: number, status: "accepted" | "rejected" | "applied") {
    await decideM.mutateAsync({ id, status });
    utils.adjustments.list.invalidate();
    toast.success(status);
  }
  async function rebuild() {
    const res: any = await rebuildM.mutateAsync();
    utils.adjustments.list.invalidate();
    utils.needsWork.list.invalidate();
    toast.success(`${res.adjustmentsAdded} suggestions added · ${res.needsWorkAdded} needs-work seeded.`);
  }

  return (
    <div className="curriculum-page space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold curriculum-title">Curriculum</h1>
        <p className="text-sm mt-1 curriculum-subtitle">Subjects, skills, and the books we're working through.</p>
      </header>

      {/* 2026-05-21 — IEP reference moved off Settings ("too much") and onto
          Curriculum Hub where the actual learning data lives. Collapsible so
          it doesn't clutter the page for daily use. */}
      <details className="cozy-card p-3 rounded-lg">
        <summary className="cursor-pointer text-sm font-medium">
          IEP reference (goals, accommodations, present levels)
        </summary>
        <div className="mt-3">
          <IepReferencePanel />
        </div>
      </details>

      {/* Push 37 (2026-05-13) — Tomorrow's draft preview strip. */}
      {tomorrowPreview.data && (
        <Card
          className="cozy-card p-4 border-2 border-sky-300/40 bg-sky-50/50 dark:bg-sky-950/20"
          data-testid="tomorrow-draft-strip"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="font-display font-semibold text-base">
                Tomorrow's draft · {(tomorrowPreview.data as any).dayLabel}
              </h2>
              {(tomorrowPreview.data as any).planExists ? (
                (tomorrowPreview.data as any).blockCount > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(tomorrowPreview.data as any).blockCount} block{(tomorrowPreview.data as any).blockCount === 1 ? "" : "s"} committed by the nightly draft.
                      {(tomorrowPreview.data as any).firstBlockTitle ? (
                        <> First up: <span className="font-medium">{(tomorrowPreview.data as any).firstBlockTitle}</span>.</>
                      ) : null}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      {((tomorrowPreview.data as any).subjects as string[]).map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                          {s}
                        </span>
                      ))}
                    </div>
                    {(tomorrowPreview.data as any).lastGeneratedAt && (
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Generated {new Date((tomorrowPreview.data as any).lastGeneratedAt).toLocaleString()}.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    Plan row exists but no blocks were committed by the nightly draft. Re-run with the button below.
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  No plan row yet — the nightly draft hasn't run for this date. Use "Sync next 5 school days" to force it now.
                </p>
              )}
            </div>
            <a
              href="/agenda-editor"
              className="text-xs px-3 py-1.5 rounded-md border border-sky-400/60 bg-white hover:bg-sky-100 dark:bg-sky-900/40 dark:hover:bg-sky-900/60 text-sky-900 dark:text-sky-100 shrink-0"
            >
              Open in Agenda Editor →
            </a>
          </div>
          {/* Push 48 (2026-05-13) — tap-block inline edit (start time + duration only). */}
          <TomorrowTapEditList />
        </Card>
      )}

      {/* Push 45 (2026-05-13) — Catch-up engine rollup. */}
      <CatchUpRollupStrip />

      {/* AI agenda sync strip — pinned at top so adults can refresh the next 5 school days from one place */}
      <Card className="cozy-card p-4 border-2 border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-base">Tomorrow & the week ahead</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Re-draft the next 5 school days using everything Reagan has learned so far + the Q4 standards + her IEP. Skips weekends and Indian Hill off-days automatically.
            </p>
            {syncFutureDays.data ? (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {(syncFutureDays.data as any).results?.map((r: any) => (
                  <span key={r.date} className={
                    r.status === "committed" ? "px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" :
                    r.status === "skipped_weekend" ? "px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300" :
                    r.status === "skipped_off" ? "px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" :
                    "px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
                  }>
                    {r.date.slice(5)} {r.status === "committed" ? `✓ ${r.blockCount}` : r.status.replace("skipped_","— ")}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <Button
            size="sm"
            disabled={syncFutureDays.isPending}
            onClick={async () => {
              try {
                const r: any = await syncFutureDays.mutateAsync({ days: 5 });
                toast.success(`Synced ${r.committed} school day${r.committed === 1 ? "" : "s"}.`);
              } catch (e: any) {
                toast.error(e?.message || "Sync failed");
              }
            }}
          >
            {syncFutureDays.isPending ? "Syncing…" : "Sync next 5 school days"}
          </Button>
        </div>
      </Card>

      <SubjectColorKey variant="schedule" />

      {/* v2.41: CurriculumProgressArcs moved to /analytics. */}

      <CurriculumTopicsTree />

      <Card className="cozy-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-semibold">Adaptive suggestions</h2>
            <p className="text-xs text-muted-foreground">Suggestions based on mastery ↔ recent grades. Adult only.</p>
          </div>
          <Button size="sm" onClick={rebuild} disabled={rebuildM.isPending}>
            {rebuildM.isPending ? "Analyzing…" : "Rebuild suggestions"}
          </Button>
        </div>
        {((subjectGrades.data as any[]) ?? []).length > 0 && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            {((subjectGrades.data as any[]) ?? []).map((g: any) => {
              const t = subjectTint(g.subjectSlug);
              return (
              <div key={g.subjectSlug} className="text-xs p-2 rounded flex justify-between" style={tintCardStyle(g.subjectSlug)}>
                <span className="font-semibold" style={tintInkStyle(g.subjectSlug)}>{t.emoji} {t.label}</span>
                <span className={g.average < 70 ? "text-red-700 font-bold" : "font-semibold"} style={g.average >= 70 ? tintInkStyle(g.subjectSlug) : undefined}>{g.letter} · {g.average}%</span>
              </div>
              );
            })}
          </div>
        )}
        {proposed.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No proposed adjustments. Click "Rebuild suggestions" to scan mastery + recent grades.</div>
        ) : (
          <div className="space-y-2">
            {proposed.map((r: any) => (
              <div key={r.id} className="p-3 rounded-md border bg-card/40 dark:bg-card/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold capitalize">{r.subjectSlug}</div>
                    <div className="text-sm">{r.suggestion}</div>
                    {r.reason && <div className="text-xs text-muted-foreground">{r.reason}</div>}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant="outline">{r.status}</Badge>
                    <Button size="sm" variant="outline" className="bg-transparent" onClick={() => decide(r.id, "accepted")}>Accept</Button>
                    <Button size="sm" variant="outline" className="bg-transparent" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <section>
        <h2 className="font-display font-semibold mb-3">Subjects</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {subjects.data?.map((s: any) => (
            <Card key={s.id} className="cozy-card p-4" style={tintCardStyle(s.slug)}>
              <div className="text-2xl mb-1">{s.emoji || subjectTint(s.slug).emoji}</div>
              <div className="font-display font-semibold" style={tintInkStyle(s.slug)}>{s.name}</div>
              {s.description && <p className="text-xs mt-1 opacity-80" style={tintInkStyle(s.slug)}>{s.description}</p>}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display font-semibold mb-3">Skills Mastery</h2>
        <div className="space-y-2">
          {skills.data?.map((sk: any) => (
            <Card key={sk.id} className="cozy-card p-3" style={tintCardStyle(sk.subjectSlug)}>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium" style={tintInkStyle(sk.subjectSlug)}>{subjectTint(sk.subjectSlug).emoji} {sk.skillName}</div>
                  <div className="text-xs opacity-80" style={tintInkStyle(sk.subjectSlug)}>{subjectTint(sk.subjectSlug).label}</div>
                </div>
                <div className="font-mono text-sm font-semibold" style={tintInkStyle(sk.subjectSlug)}>{sk.currentScore || 0}%</div>
              </div>
              <Progress value={sk.currentScore || 0} className="mt-2 h-2" />
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display font-semibold">Reagan's Books</h2>
          <span className="text-xs text-muted-foreground">Click status to update · use “Mark pages already done” to skip what tutors already covered</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {((books.data as any[]) ?? []).map((b: any) => (
            <OwnedBookCard key={b.id} book={b} />
          ))}
        </div>
      </section>
    </div>
  );
}


/**
 * Push 45 (2026-05-13) — Catch-up engine rollup.
 *
 * Reads `trpc.curriculum.catchUp` once and renders a single horizontal
 * row of subject pills. Each pill carries:
 *   - subject name + mastery % (done/total),
 *   - a colored traffic-light dot (green/yellow/red bucket),
 *   - the next 3 open topics as inline chips Mom can click to deep-link
 *     into the topic-list scroll position via #topic-${id} anchors.
 *
 * Hidden entirely when the query is empty so the page doesn't show a
 * placebo card before curriculum has been seeded.
 */
function CatchUpRollupStrip() {
  const q = (trpc as any).curriculum?.catchUp?.useQuery?.(undefined, { staleTime: 60_000 });
  const data = (q?.data as Array<any> | undefined) ?? [];
  if (!data.length) return null;

  const lightStyles: Record<string, { dot: string; pill: string; label: string }> = {
    green: {
      dot: "bg-emerald-500",
      pill: "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-700",
      label: "text-emerald-800 dark:text-emerald-200",
    },
    yellow: {
      dot: "bg-amber-500",
      pill: "border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-700",
      label: "text-amber-800 dark:text-amber-200",
    },
    red: {
      dot: "bg-rose-500",
      pill: "border-rose-300 bg-rose-50/70 dark:bg-rose-950/30 dark:border-rose-700",
      label: "text-rose-800 dark:text-rose-200",
    },
  };

  return (
    <Card className="cozy-card p-4" data-testid="catch-up-rollup-strip">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display font-semibold text-base">Catch-up snapshot</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per-subject mastery % + next three open topics. Tap a chip to jump to that topic below.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ≥ 67%</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 34–66%</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> ≤ 33%</span>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {data.map((s: any) => {
          const style = lightStyles[s.trafficLight] ?? lightStyles.yellow;
          return (
            <div
              key={s.subjectSlug}
              className={"flex flex-col gap-1.5 rounded-lg border p-2.5 " + style.pill}
              data-subject={s.subjectSlug}
              data-traffic-light={s.trafficLight}
              data-testid={`catch-up-pill-${s.subjectSlug}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={"w-2.5 h-2.5 rounded-full " + style.dot} aria-hidden />
                  <span className={"font-medium truncate " + style.label}>{s.subjectName}</span>
                </div>
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  <span className="font-semibold">{s.masteryPct}%</span>
                  <span className="opacity-70"> · {s.done}/{s.total}</span>
                </div>
              </div>
              {s.nextThree.length === 0 ? (
                <p className="text-[11px] italic text-muted-foreground">All topics done. 🎉</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {s.nextThree.map((t: any) => (
                    <a
                      key={t.id}
                      href={`#topic-${t.id}`}
                      title={t.title}
                      className={
                        "inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border " +
                        (t.status === "inProgress"
                          ? "border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
                          : "border-border bg-card/60 hover:bg-card")
                      }
                    >
                      <span className="font-mono text-[10px] opacity-70">{t.code}</span>
                      <span className="truncate max-w-[12rem]">{t.title}</span>
                      {t.status === "inProgress" && (
                        <span aria-hidden className="text-sky-500">·</span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}


/* ============================================================================
 * Push 48 (2026-05-13) — Tomorrow Tap-block inline editor
 * ----------------------------------------------------------------------------
 * Tiny, focused inline editor: lists tomorrow's committed blocks (sortOrder
 * asc) and lets adults tap any block to tweak just two fields — startTime
 * (HH:MM) and durationMin (5–180). Anything beyond that drops them into the
 * full AgendaEditor via the "Open in Agenda Editor →" CTA above. The goal is
 * "ten-second clock fix" without leaving the Curriculum hub.
 * ========================================================================== */
import { useState } from "react";
import { Input } from "@/components/ui/input";

function TomorrowTapEditList() {
  const utils = trpc.useUtils();
  const q = (trpc as any).curriculum?.tomorrowBlocks?.useQuery?.() ?? { data: null, isLoading: false };
  const update = (trpc as any).blocks?.update?.useMutation?.({
    onSuccess: () => {
      (utils as any).curriculum?.tomorrowBlocks?.invalidate?.();
      (utils as any).curriculum?.tomorrowPreview?.invalidate?.();
    },
  }) ?? { mutateAsync: async () => {}, isPending: false };

  if (!q.data) return null;
  const blocks = (q.data as any).blocks as any[];
  if (!blocks?.length) return null;

  return (
    <div className="mt-3 border-t border-sky-300/30 pt-2" data-testid="tomorrow-tap-edit">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
        Tap a block to fix the clock — start time + duration only
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {blocks.map((b) => (
          <TomorrowEditableBlockRow
            key={b.id}
            block={b}
            disabled={update.isPending}
            onPatch={async (patch) => {
              try {
                await update.mutateAsync({ id: b.id, ...patch });
                toast.success("Saved.");
              } catch (e: any) {
                toast.error(e?.message ?? "Save failed");
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TomorrowEditableBlockRow({
  block,
  disabled,
  onPatch,
}: {
  block: any;
  disabled: boolean;
  onPatch: (patch: { startTime?: string | null; durationMin?: number }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState<string>(block.startTime ?? "");
  const [durationMin, setDurationMin] = useState<number>(block.durationMin ?? 30);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-[11px] px-2 py-1 rounded border border-sky-200/50 bg-white/70 dark:bg-sky-900/30 hover:bg-sky-50 dark:hover:bg-sky-900/60 flex items-center justify-between gap-2 min-w-0"
        title="Tap to edit start time + duration"
      >
        <span className="truncate">
          <span className="font-mono text-[10px] opacity-70 mr-1">
            {block.startTime ?? "--:--"}
          </span>
          {block.title ?? "(untitled)"}
        </span>
        <span className="text-[10px] tabular-nums opacity-70 shrink-0">
          {block.durationMin ?? 30} min
        </span>
      </button>
    );
  }

  return (
    <div className="text-[11px] px-2 py-1.5 rounded border border-sky-300 bg-white dark:bg-sky-900/40">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="truncate font-medium">{block.title ?? "(untitled)"}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] text-muted-foreground hover:underline shrink-0"
        >
          cancel
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="h-7 text-[11px] w-[5.5rem]"
          disabled={disabled}
          aria-label="Start time"
        />
        <Input
          type="number"
          min={5}
          max={180}
          step={5}
          value={durationMin}
          onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
          className="h-7 text-[11px] w-[4.5rem]"
          disabled={disabled}
          aria-label="Duration minutes"
        />
        <span className="text-[10px] text-muted-foreground">min</span>
        <button
          type="button"
          disabled={disabled}
          onClick={async () => {
            const patch: { startTime?: string | null; durationMin?: number } = {};
            const trimmed = startTime.trim();
            if (trimmed && /^\d{1,2}:\d{2}$/.test(trimmed)) patch.startTime = trimmed;
            else if (trimmed === "") patch.startTime = null;
            const d = Math.max(5, Math.min(180, Math.round(durationMin)));
            if (d !== (block.durationMin ?? 30)) patch.durationMin = d;
            if (Object.keys(patch).length === 0) {
              setOpen(false);
              return;
            }
            await onPatch(patch);
            setOpen(false);
          }}
          className="ml-auto text-[10px] px-2 py-0.5 rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
