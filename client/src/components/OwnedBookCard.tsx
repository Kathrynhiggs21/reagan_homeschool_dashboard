import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { subjectTint, tintCardStyle, tintInkStyle } from "@/lib/subjectColors";

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  not_started:               { label: "not started",            tone: "bg-slate-100 text-slate-700" },
  in_progress:               { label: "in progress",            tone: "bg-emerald-100 text-emerald-800" },
  in_progress_unstructured:  { label: "scattered (in progress)",tone: "bg-amber-100 text-amber-800" },
  done:                      { label: "done",                   tone: "bg-blue-100 text-blue-800" },
  shelved:                   { label: "shelved",                tone: "bg-zinc-200 text-zinc-700" },
};

export default function OwnedBookCard({ book }: { book: any }) {
  const utils = trpc.useUtils();
  const subjectSlug = book.subjectSlug || "reading";
  const tint = subjectTint(subjectSlug);
  const [pageInput, setPageInput] = useState("");
  const [showRecon, setShowRecon] = useState(false);

  const setStatusM = trpc.books.setStatus.useMutation({
    onSuccess: () => { utils.books.list.invalidate(); toast.success("Status updated"); },
  });
  const advanceChapM = trpc.books.advanceChapter.useMutation({
    onSuccess: () => { utils.books.list.invalidate(); toast.success("Chapter saved"); },
  });
  const advancePageM = trpc.books.advancePage.useMutation({
    onSuccess: () => { utils.books.list.invalidate(); toast.success("Page saved"); },
  });
  const markPagesDoneM = trpc.books.markPagesDone.useMutation({
    onSuccess: () => { utils.books.listPagesDone.invalidate({ bookId: book.id }); toast.success("Pages marked"); },
  });
  const unmarkPageM = trpc.books.unmarkPage.useMutation({
    onSuccess: () => { utils.books.listPagesDone.invalidate({ bookId: book.id }); },
  });
  const pagesDoneQ = trpc.books.listPagesDone.useQuery({ bookId: book.id }, { enabled: showRecon });

  const isWorkbook = book.type === "workbook" || book.type === "reference";
  const isChapterBook = book.type === "novel" || book.type === "chapter_book";
  const status = String(book.status || "in_progress");
  const tone = STATUS_LABEL[status] || STATUS_LABEL.in_progress;

  const pagesDoneList = useMemo(() => (pagesDoneQ.data as any[] | undefined) ?? [], [pagesDoneQ.data]);

  function parsePageList(input: string): number[] {
    const out = new Set<number>();
    for (const part of input.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)) {
      const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const a = Number(m[1]); const b = Number(m[2]);
        if (a >= 1 && b >= a && (b - a) < 200) for (let i = a; i <= b; i++) out.add(i);
      } else {
        const n = Number(part); if (Number.isInteger(n) && n >= 1 && n <= 4000) out.add(n);
      }
    }
    return Array.from(out).sort((a, b) => a - b);
  }

  return (
    <Card className="cozy-card p-4" style={tintCardStyle(subjectSlug)}>
      <div className="flex gap-3">
        <span className="text-3xl">{isWorkbook ? "📓" : "📖"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display font-semibold truncate" style={tintInkStyle(subjectSlug)}>{book.title}</div>
              <div className="text-xs opacity-80 truncate" style={tintInkStyle(subjectSlug)}>{book.author || tint.label} · {tint.label}</div>
            </div>
            <span className={`shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${tone.tone}`}>{tone.label}</span>
          </div>

          {isChapterBook && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Chapter</span>
              <Input
                type="number" min={0} max={book.totalChapters || 999}
                value={book.currentChapter ?? 0}
                className="h-7 w-16 text-xs"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v) && v >= 0) advanceChapM.mutate({ id: book.id, currentChapter: v });
                }}
              />
              {book.totalChapters ? <span className="text-xs text-muted-foreground">of {book.totalChapters}</span> : null}
            </div>
          )}

          {isWorkbook && book.totalPages && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Page {book.currentPage || 0} of {book.totalPages}</span>
                <span className="text-muted-foreground">{Math.round(((book.currentPage || 0) / book.totalPages) * 100)}%</span>
              </div>
              <Progress value={((book.currentPage || 0) / book.totalPages) * 100} className="h-1.5 mt-1" />
            </div>
          )}

          {/* Status quick-toggle */}
          <div className="mt-3 flex flex-wrap gap-1">
            {(["not_started","in_progress","in_progress_unstructured","done","shelved"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === s ? "default" : "outline"}
                className="h-6 px-2 text-[10px] bg-transparent"
                onClick={() => setStatusM.mutate({ id: book.id, status: s })}
              >{STATUS_LABEL[s].label}</Button>
            ))}
          </div>

          {/* Scattered-page reconciliation tool — only meaningful for workbooks */}
          {isWorkbook && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                className="bg-transparent text-xs h-7"
                onClick={() => setShowRecon(s => !s)}
              >
                {showRecon ? "Hide pages-already-done" : "Mark pages already done"}
              </Button>
              {showRecon && (
                <div className="mt-2 rounded-md border bg-white/40 p-2">
                  <div className="text-xs text-muted-foreground mb-1.5">
                    Type pages or ranges Reagan already finished (e.g. <code className="font-mono">12, 14, 30-35</code>). They'll be skipped on future agendas.
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="12, 14, 30-35"
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={markPagesDoneM.isPending || !pageInput.trim()}
                      onClick={async () => {
                        const list = parsePageList(pageInput);
                        if (list.length === 0) { toast.error("Couldn't parse any page numbers"); return; }
                        await markPagesDoneM.mutateAsync({ bookId: book.id, pageNumbers: list, source: "tutor_recon" });
                        setPageInput("");
                      }}
                    >Mark done</Button>
                  </div>
                  {pagesDoneList.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {pagesDoneList.map((row: any) => (
                        <button
                          key={row.id}
                          onClick={() => unmarkPageM.mutate({ bookId: book.id, pageNumber: row.pageNumber })}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-700 hover:line-through"
                          title="Click to un-mark"
                        >pg {row.pageNumber}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {book.notes && (
            <div className="mt-2 text-[11px] italic opacity-80" style={tintInkStyle(subjectSlug)}>{book.notes}</div>
          )}
        </div>
      </div>
    </Card>
  );
}
