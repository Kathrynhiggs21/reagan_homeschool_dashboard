import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { useState } from "react";
import { toast } from "sonner";

type Book = {
  id: number;
  title: string;
  author?: string | null;
  type?: string | null;
  subjectSlug?: string | null;
  currentPage?: number | null;
  totalPages?: number | null;
};

// Legal launch links for Tuck Everlasting (no pirated PDFs — each store page for the book).
const TUCK_LINKS = [
  { label: "Kindle",       url: "https://www.amazon.com/Tuck-Everlasting-Natalie-Babbitt-ebook/dp/B009SN2T24", emoji: "📱" },
  { label: "Apple Books",  url: "https://books.apple.com/us/book/tuck-everlasting/id420929394",              emoji: "🍎" },
  { label: "Libby",        url: "https://libbyapp.com/search/query-Tuck%20Everlasting",                      emoji: "🎧" },
  { label: "Audible",      url: "https://www.audible.com/pd/Tuck-Everlasting-Audiobook/B002V5ADXA",         emoji: "🔊" },
];

function isTuckEverlasting(b: Book): boolean {
  return (b.title || "").toLowerCase().includes("tuck everlasting");
}

export default function Bookshelf() {
  const books = trpc.books.list.useQuery();
  const updateProgress = trpc.books.advancePage.useMutation();
  const utils = trpc.useUtils();
  const { unlocked } = useAdultLock();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftPage, setDraftPage] = useState<string>("");

  function startEdit(b: Book) {
    setEditingId(b.id);
    setDraftPage(String(b.currentPage ?? 0));
  }
  function saveEdit(b: Book) {
    const page = Math.max(0, Math.min(Number(draftPage) || 0, b.totalPages ?? 9999));
    updateProgress.mutate(
      { id: b.id, currentPage: page },
      {
        onSuccess: () => {
          toast.success("Bookmark saved.");
          setEditingId(null);
          utils.books.list.invalidate();
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="font-chalk-hand text-xl leading-none chalk-yellow">Your library</div>
        <h1 className="font-display text-4xl md:text-5xl mt-1 chalk-white">Bookshelf</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Workbooks, read-alouds, and the stories you're inside of.
        </p>
      </header>

      <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
        {books.data?.map((b: Book) => {
          const pct = b.totalPages ? Math.round(((b.currentPage || 0) / b.totalPages) * 100) : 0;
          const isTuck = isTuckEverlasting(b);
          return (
            <Card key={b.id} className="classroom-card p-5">
              <div className="flex gap-4">
                <span className="text-5xl shrink-0">{isTuck ? "🌳" : "📖"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-lg leading-tight">{b.title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {b.author || "Unknown author"} {b.subjectSlug && `· ${b.subjectSlug}`}
                  </div>

                  {b.totalPages ? (
                    <div className="mt-3">
                      <div className="text-xs text-neutral-600 flex items-center justify-between">
                        <span>
                          Page <b>{b.currentPage || 0}</b> of {b.totalPages}
                        </span>
                        <span className="text-neutral-500">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-2 mt-1" />
                    </div>
                  ) : null}

                  {/* Chapter bookmark — adult can edit it; kid just sees current page. */}
                  {unlocked && (
                    <div className="mt-3">
                      {editingId === b.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={b.totalPages ?? undefined}
                            value={draftPage}
                            onChange={(e) => setDraftPage(e.target.value)}
                            className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm"
                          />
                          <Button size="sm" onClick={() => saveEdit(b)}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="bg-transparent h-7 text-xs" onClick={() => startEdit(b)}>
                          ✎ Update bookmark
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Tuck Everlasting legal launch tiles */}
                  {isTuck && (
                    <div className="mt-4 border-t border-neutral-200 pt-3">
                      <div className="text-xs font-semibold text-neutral-700 mb-2">
                        Read or listen:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {TUCK_LINKS.map((l) => (
                          <a
                            key={l.label}
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-800 border border-neutral-200"
                          >
                            <span>{l.emoji}</span>
                            <span>{l.label}</span>
                          </a>
                        ))}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-2">
                        Today's read-aloud block on Today picks up at page <b>{b.currentPage || 1}</b>.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {!books.isLoading && (books.data?.length ?? 0) === 0 && (
        <Card className="classroom-card p-6 text-center">
          <p className="font-display">No books on the shelf yet.</p>
        </Card>
      )}
    </div>
  );
}
