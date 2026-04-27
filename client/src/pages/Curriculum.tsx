import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function Curriculum() {
  const subjects = trpc.subjects.list.useQuery();
  const skills = trpc.skills.list.useQuery();
  const books = trpc.books.list.useQuery();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">Curriculum</h1>
        <p className="text-muted-foreground text-sm mt-1">Subjects, skills, and the books we're working through.</p>
      </header>

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
