import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Curriculum() {
  const subjects = trpc.subjects.list.useQuery();
  const skills = trpc.skills.list.useQuery();
  const books = trpc.books.list.useQuery();
  const adjustments = trpc.adjustments.list.useQuery({});
  const subjectGrades = trpc.submissions.subjectGrades.useQuery();
  const decideM = trpc.adjustments.decide.useMutation();
  const rebuildM = trpc.adjustments.rebuild.useMutation();
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
            {((subjectGrades.data as any[]) ?? []).map((g: any) => (
              <div key={g.subjectSlug} className="text-xs p-2 rounded border bg-white/40 flex justify-between">
                <span className="capitalize">{g.subjectSlug}</span>
                <span className={g.average < 70 ? "text-red-700 font-semibold" : "text-neutral-700"}>{g.letter} · {g.average}%</span>
              </div>
            ))}
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
            <Card key={s.id} className="cozy-card p-4">
              <div className="text-2xl mb-1">{s.emoji}</div>
              <div className="font-display font-semibold">{s.name}</div>
              {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display font-semibold mb-3">Skills Mastery</h2>
        <div className="space-y-2">
          {skills.data?.map((sk: any) => (
            <Card key={sk.id} className="cozy-card p-3">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{sk.skillName}</div>
                  <div className="text-xs text-muted-foreground">{sk.subjectSlug}</div>
                </div>
                <div className="font-mono text-sm font-semibold">{sk.currentScore || 0}%</div>
              </div>
              <Progress value={sk.currentScore || 0} className="mt-2 h-2" />
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display font-semibold mb-3">Books in Progress</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {books.data?.map((b: any) => (
            <Card key={b.id} className="cozy-card p-4">
              <div className="flex gap-3">
                <span className="text-3xl">📖</span>
                <div className="flex-1">
                  <div className="font-display font-semibold">{b.title}</div>
                  <div className="text-xs text-muted-foreground">{b.author} · {b.subjectSlug}</div>
                  {b.totalPages && (
                    <div className="mt-2">
                      <div className="text-xs text-muted-foreground">Page {b.currentPage || 0} of {b.totalPages}</div>
                      <Progress value={((b.currentPage || 0) / b.totalPages) * 100} className="h-1.5 mt-1" />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
