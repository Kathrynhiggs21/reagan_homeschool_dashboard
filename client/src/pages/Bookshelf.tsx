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
  coverUrl?: string | null;
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

/* --------------------------------------------------------------------------
 * 2026-06-17 (Katy): in-browser reading.
 * Reagan can read books online without leaving the dashboard or paying.
 * We only ever open FREE, LEGAL sources:
 *   • Open Library's "read" search (millions of free/borrowable books)
 *   • Project Gutenberg (full public-domain texts, e.g. classics)
 * In-copyright titles (like Tuck Everlasting) still show the legal store /
 * library launch tiles instead of a full text.
 * ------------------------------------------------------------------------ */
function openLibraryReadUrl(b: Book): string {
  const q = encodeURIComponent(`${b.title || ""} ${b.author || ""}`.trim());
  return `https://openlibrary.org/search?q=${q}&mode=ebooks&has_fulltext=true`;
}
function gutenbergSearchUrl(b: Book): string {
  const q = encodeURIComponent(`${b.title || ""} ${b.author || ""}`.trim());
  return `https://www.gutenberg.org/ebooks/search/?query=${q}`;
}

function OnlineReaderDialog({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const [source, setSource] = useState<"openlibrary" | "gutenberg">("openlibrary");
  if (!book) return null;
  const url = source === "openlibrary" ? openLibraryReadUrl(book) : gutenbergSearchUrl(book);
  return (
    <Dialog open={!!book} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden h-[85vh] flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="font-display flex items-center gap-2 flex-wrap">
            <span>📖 Read online — {book.title}</span>
            <span className="ml-auto flex gap-1">
              <Button size="sm" variant={source === "openlibrary" ? "default" : "outline"} className={source === "openlibrary" ? "" : "bg-transparent"} onClick={() => setSource("openlibrary")}>Open Library</Button>
              <Button size="sm" variant={source === "gutenberg" ? "default" : "outline"} className={source === "gutenberg" ? "" : "bg-transparent"} onClick={() => setSource("gutenberg")}>Free Classics</Button>
              <a href={url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="bg-transparent">Open in new tab ↗</Button></a>
            </span>
          </DialogTitle>
        </DialogHeader>
        <iframe
          title={`Read ${book.title}`}
          src={url}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
        <p className="text-[11px] text-muted-foreground px-4 py-2 shrink-0">
          Free, legal readers only. If a book can’t show here, tap “Open in new tab”.
        </p>
      </DialogContent>
    </Dialog>
  );
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
  const videos = trpc.review.list.useQuery({ kind: "video", approvedOnly: true });
  const updateProgress = trpc.books.advancePage.useMutation();
  const del = trpc.books.delete.useMutation();
  const utils = trpc.useUtils();
  const { unlocked } = useAdultLock();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftPage, setDraftPage] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [reading, setReading] = useState<Book | null>(null);

  // Dedupe by normalized title+author so duplicate seeds don't double-render.
  const dedupedBooks: Book[] = (() => {
    const seen = new Map<string, Book>();
    for (const b of (books.data || []) as Book[]) {
      const key = `${(b.title || "").toLowerCase().trim()}|${(b.author || "").toLowerCase().trim()}`;
      if (!seen.has(key)) seen.set(key, b);
    }
    return Array.from(seen.values());
  })();

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
        {dedupedBooks.map((b: Book) => {
          const pct = b.totalPages ? Math.round(((b.currentPage || 0) / b.totalPages) * 100) : 0;
          const isTuck = isTuckEverlasting(b);
          const subj = b.subjectSlug || "reading";
          const tint = subjectTint(subj);
          return (
            <Card key={b.id} className="classroom-card p-5" style={tintCardStyle(subj)}>
              <div className="flex gap-4">
                {b.coverUrl ? (
                  <img
                    src={b.coverUrl}
                    alt={`${b.title} cover`}
                    className="shrink-0 w-14 h-20 sm:w-16 sm:h-24 rounded-md object-cover border border-white/20 shadow-sm bg-white/60"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <span className="text-5xl shrink-0">{isTuck ? "🌳" : (tint.emoji || "📖")}</span>
                )}
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

                  {/* 2026-06-17: Read-online button on every book (free legal
                      sources). Hidden for in-copyright Tuck, which keeps its
                      dedicated store/library tiles below. */}
                  {!isTuck && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-transparent h-7 text-xs"
                        onClick={() => setReading(b)}
                      >
                        📖 Read online
                      </Button>
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

      {!books.isLoading && dedupedBooks.length === 0 && (
        <Card className="classroom-card p-6 text-center">
          <p className="font-display">No books on the shelf yet.</p>
        </Card>
      )}

      {/* Watch & Learn — curated YouTube picks */}
      {Array.isArray(videos.data) && videos.data.length > 0 && (
        <section className="pt-4">
          <div className="flex items-baseline gap-3 mb-3 flex-wrap">
            <h2 className="font-display font-bold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", color: "#ff9fb2", textShadow: "0 3px 0 rgba(0,0,0,0.35)" }}>Watch</h2>
            <h2 className="font-display font-bold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", color: "#ffd97a", textShadow: "0 3px 0 rgba(0,0,0,0.35)" }}>&amp;</h2>
            <h2 className="font-display font-bold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", color: "#7fe3c4", textShadow: "0 3px 0 rgba(0,0,0,0.35)" }}>Learn</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.data.map((v: any) => (
              <a
                key={v.id}
                href={v.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl p-4 transition hover:-translate-y-1"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.25))",
                  border: "2px solid rgba(255,159,178,0.35)",
                  boxShadow: "0 6px 0 rgba(0,0,0,0.3), 0 0 18px rgba(255,159,178,0.12)",
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-4xl" style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.4))" }}>📺</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold leading-tight" style={{ color: "#ff9fb2", fontSize: "1.1rem", textShadow: "0 2px 0 rgba(0,0,0,0.35)" }}>{v.title}</div>
                    {v.description && (
                      <p className="mt-1 chalk-white" style={{ fontSize: "0.95rem", opacity: 0.85, lineHeight: 1.35 }}>{v.description}</p>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Always-available way to find something free to read online. */}
      <Card className="classroom-card p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-4xl">🌐</span>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-lg chalk-white">Read free books online</div>
            <p className="text-sm text-muted-foreground">Thousands of free, legal books — right here in the dashboard.</p>
          </div>
          <Button
            onClick={() => setReading({ id: -1, title: "", author: "" } as Book)}
          >
            Browse free books
          </Button>
        </div>
      </Card>

      <OnlineReaderDialog book={reading} onClose={() => setReading(null)} />
      {adding && <AddBookDialog open={adding} onOpenChange={setAdding} />}
    </div>
  );
}
