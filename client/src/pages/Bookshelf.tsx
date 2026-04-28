import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { useState } from "react";
import { toast } from "sonner";
import { trpc as trpcRoot } from "@/lib/trpc";
import SubjectColorKey from "@/components/SubjectColorKey";
import { subjectTint, tintCardStyle, tintInkStyle } from "@/lib/subjectColors";

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

function AddBookDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const utils = trpcRoot.useUtils();
  const create = trpcRoot.books.create.useMutation();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [totalPages, setTotalPages] = useState("");
  async function save() {
    if (!title.trim()) return toast.error("Title required.");
    try {
      await create.mutateAsync({ title, author: author || undefined, totalPages: totalPages ? Number(totalPages) : undefined } as any);
      utils.books.list.invalidate();
      toast.success("Book added");
      onOpenChange(false);
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add a book</DialogTitle></DialogHeader>
        <div className="space-y-2 pt-2">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <Input placeholder="Total pages (optional)" type="number" value={totalPages} onChange={(e) => setTotalPages(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="bg-transparent" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={create.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Bookshelf() {
  const books = trpc.books.list.useQuery();
  const updateProgress = trpc.books.advancePage.useMutation();
  const del = trpc.books.delete.useMutation();
  const utils = trpc.useUtils();
  const { unlocked } = useAdultLock();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftPage, setDraftPage] = useState<string>("");
  const [adding, setAdding] = useState(false);

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
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="font-chalk-hand text-xl leading-none chalk-yellow">Your library</div>
          <h1 className="font-display text-4xl md:text-5xl mt-1 chalk-white">Bookshelf</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Workbooks, read-alouds, and the stories you're inside of.
          </p>
        </div>
        {unlocked && (
          <Button size="sm" onClick={() => setAdding(true)}>+ Add book</Button>
        )}
      </header>

      <SubjectColorKey variant="schedule" />

      <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
        {books.data?.map((b: Book) => {
          const pct = b.totalPages ? Math.round(((b.currentPage || 0) / b.totalPages) * 100) : 0;
          const isTuck = isTuckEverlasting(b);
          const subj = b.subjectSlug || "reading";
          const tint = subjectTint(subj);
          return (
            <Card key={b.id} className="classroom-card p-5" style={tintCardStyle(subj)}>
              <div className="flex gap-4">
                <span className="text-5xl shrink-0">{isTuck ? "🌳" : (tint.emoji || "📖")}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-lg leading-tight" style={tintInkStyle(subj)}>{b.title}</div>
                  <div className="text-xs mt-0.5 opacity-80" style={tintInkStyle(subj)}>
                    {b.author || "Unknown author"} · {tint.label}
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
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
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
                        <>
                          <Button size="sm" variant="outline" className="bg-transparent h-7 text-xs" onClick={() => startEdit(b)}>
                            ✎ Update bookmark
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent h-7 text-xs text-destructive"
                            onClick={async () => { if (confirm(`Remove "${b.title}"?`)) { await del.mutateAsync({ id: b.id }); utils.books.list.invalidate(); toast.success("Book removed"); } }}
                          >🗑 Remove</Button>
                        </>
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
      {adding && <AddBookDialog open={adding} onOpenChange={setAdding} />}
    </div>
  );
}
