import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SubjectColorKey from "@/components/SubjectColorKey";
import CurriculumTopicsTree from "@/components/CurriculumTopicsTree";
import CurriculumProgressArcs from "@/components/CurriculumProgressArcs";
import OwnedBookCard from "@/components/OwnedBookCard";
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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">Curriculum</h1>
        <p className="text-muted-foreground text-sm mt-1">Subjects, skills, and the books we're working through.</p>
      </header>

      {/* AI agenda sync strip — pinned at top so adults can refresh the next 5 school days from one place */}
      <Card className="cozy-card p-4 border-2 border-amber-300/40 bg-amber-50/50">
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
                    r.status === "committed" ? "px-2 py-0.5 rounded bg-emerald-100 text-emerald-800" :
                    r.status === "skipped_weekend" ? "px-2 py-0.5 rounded bg-slate-100 text-slate-600" :
                    r.status === "skipped_off" ? "px-2 py-0.5 rounded bg-blue-100 text-blue-700" :
                    "px-2 py-0.5 rounded bg-rose-100 text-rose-700"
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

      <CurriculumProgressArcs />

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
              <div key={r.id} className="p-3 rounded-md border bg-white/40">
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
