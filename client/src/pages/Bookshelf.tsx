import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function Bookshelf() {
  const books = trpc.books.list.useQuery();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-display font-semibold">Bookshelf 📚</h1>
        <p className="text-muted-foreground text-sm mt-1">Your library — workbooks, read-alouds, and the stories you're inside of.</p>
      </header>
      <div className="grid sm:grid-cols-2 gap-3">
        {books.data?.map((b: any) => (
          <Card key={b.id} className="cozy-card p-4 flex gap-3">
            <span className="text-4xl">📖</span>
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
          </Card>
        ))}
      </div>
    </div>
  );
}
