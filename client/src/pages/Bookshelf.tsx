import { trpc } from "@/lib/trpc";
import PageTitle from "@/components/PageTitle";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { useState } from "react";
import { toast } from "sonner";
import { trpc as trpcRoot } from "@/lib/trpc";
import BookCover from "@/components/BookCover";

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
      <DialogContent className="max-w-5xl p-0 overflow-hidden h-[85vh] flex flex-col glass-dialog">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="font-display flex items-center gap-2 flex-wrap text-white">
            <span>📖 Read online — {book.title}</span>
            <span className="ml-auto flex gap-1">
              <button className={`glass-control h-8 px-3 text-xs ${source === "openlibrary" ? "glass-control--primary" : ""}`} onClick={() => setSource("openlibrary")}>Open Library</button>
              <button className={`glass-control h-8 px-3 text-xs ${source === "gutenberg" ? "glass-control--primary" : ""}`} onClick={() => setSource("gutenberg")}>Free Classics</button>
              <a href={url} target="_blank" rel="noreferrer"><button className="glass-control h-8 px-3 text-xs">Open in new tab ↗</button></a>
            </span>
          </DialogTitle>
        </DialogHeader>
        <iframe
          title={`Read ${book.title}`}
          src={url}
          className="flex-1 w-full border-0 rounded-b-xl bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </DialogContent>
    </Dialog>
  );
}

/* Book detail — opens when a cover is tapped. Progress, read-online, and
 * (for adults) bookmark editing all live here so the shelf stays clean. */
function BookDetailDialog({
  book, onClose, onRead, unlocked,
}: {
  book: Book | null;
  onClose: () => void;
  onRead: (b: Book) => void;
  unlocked: boolean;
}) {
  const updateProgress = trpc.books.advancePage.useMutation();
  const del = trpc.books.delete.useMutation();
  const utils = trpc.useUtils();
  const [draftPage, setDraftPage] = useState<string>("");
  const [editing, setEditing] = useState(false);

  if (!book) return null;
  const isTuck = isTuckEverlasting(book);
  const pct = book.totalPages ? Math.round(((book.currentPage || 0) / book.totalPages) * 100) : 0;

  function saveEdit() {
    if (!book) return;
    const page = Math.max(0, Math.min(Number(draftPage) || 0, book.totalPages ?? 9999));
    updateProgress.mutate({ id: book.id, currentPage: page }, {
      onSuccess: () => { toast.success("Bookmark saved."); setEditing(false); utils.books.list.invalidate(); onClose(); },
    });
  }

  return (
    <Dialog open={!!book} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg glass-dialog text-white">
        <DialogHeader><DialogTitle className="text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">{book.title}</DialogTitle></DialogHeader>
        <div className="flex gap-4 pt-1">
          <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} className="w-24 shrink-0" />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="text-sm text-white/80">{book.author || "Unknown author"}</div>
            {book.totalPages ? (
              <div>
                <div className="text-xs text-white/80 flex items-center justify-between">
                  <span>Page <b>{book.currentPage || 0}</b> of {book.totalPages}</span>
                  <span>{pct}%</span>
                </div>
                <div className="glass-progress mt-1"><span style={{ width: `${pct}%` }} /></div>
              </div>
            ) : null}

            {!isTuck && (
              <button className="glass-control glass-control--primary h-9 px-4 text-sm" onClick={() => onRead(book)}>📖 Read online</button>
            )}

            {isTuck && (
              <div>
                <div className="text-xs font-semibold text-white/90 mb-2">Read or listen:</div>
                <div className="flex flex-wrap gap-2">
                  {TUCK_LINKS.map((l) => (
                    <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="glass-control h-8 px-3 text-xs inline-flex items-center gap-1.5">
                      <span>{l.emoji}</span><span>{l.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {unlocked && (
              <div className="pt-2 border-t border-white/15 flex items-center gap-2 flex-wrap">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={book.totalPages ?? undefined} value={draftPage}
                      onChange={(e) => setDraftPage(e.target.value)} placeholder={String(book.currentPage ?? 0)}
                      className="kiwi-input w-24 h-8 text-sm" />
                    <button className="glass-control glass-control--primary h-8 px-3 text-xs" onClick={saveEdit}>Save</button>
                    <button className="glass-control h-8 px-3 text-xs" onClick={() => setEditing(false)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <button className="glass-control h-8 px-3 text-xs" onClick={() => { setDraftPage(String(book.currentPage ?? 0)); setEditing(true); }}>✎ Update bookmark</button>
                    <button className="glass-control h-8 px-3 text-xs" onClick={async () => { if (confirm(`Remove "${book.title}"?`)) { await del.mutateAsync({ id: book.id }); utils.books.list.invalidate(); toast.success("Book removed"); onClose(); } }}>🗑 Remove</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
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
      <DialogContent className="max-w-md glass-dialog text-white">
        <DialogHeader><DialogTitle className="text-white">Add a book</DialogTitle></DialogHeader>
        <div className="space-y-2 pt-2">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="kiwi-input" />
          <Input placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} className="kiwi-input" />
          <Input placeholder="Total pages (optional)" type="number" value={totalPages} onChange={(e) => setTotalPages(e.target.value)} className="kiwi-input" />
        </div>
        <DialogFooter>
          <button className="glass-control h-9 px-4 text-sm" onClick={() => onOpenChange(false)}>Cancel</button>
          <button className="glass-control glass-control--primary h-9 px-4 text-sm" onClick={save} disabled={create.isPending}>Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Split a flat list of books into shelves of N so each row can render a
 * real glass shelf plank under the covers. */
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export default function Bookshelf() {
  const books = trpc.books.list.useQuery();
  const videos = trpc.review.list.useQuery({ kind: "video", approvedOnly: true });
  const { unlocked } = useAdultLock();
  const [adding, setAdding] = useState(false);
  const [reading, setReading] = useState<Book | null>(null);
  const [detail, setDetail] = useState<Book | null>(null);

  // Dedupe by normalized title+author so duplicate seeds don't double-render.
  const dedupedBooks: Book[] = (() => {
    const seen = new Map<string, Book>();
    for (const b of (books.data || []) as Book[]) {
      const key = `${(b.title || "").toLowerCase().trim()}|${(b.author || "").toLowerCase().trim()}`;
      if (!seen.has(key)) seen.set(key, b);
    }
    return Array.from(seen.values());
  })();

  const shelves = chunk(dedupedBooks, 4);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <PageTitle icon={<span>📚</span>} title="My Books" subtitle="Tap a cover to read, bookmark, or explore" />
        </div>
        {unlocked && (
          <button className="glass-control glass-control--primary h-9 px-4 text-sm" onClick={() => setAdding(true)}>+ Add book</button>
        )}
      </header>

      {/* Real covers standing on transparent glass shelves */}
      <div className="space-y-9">
        {shelves.map((row, ri) => (
          <div key={ri} className="book-shelf">
            <div className="book-shelf-row">
              {row.map((b) => (
                <div key={b.id} className="book-shelf-item">
                  <BookCover title={b.title} author={b.author} coverUrl={b.coverUrl} onClick={() => setDetail(b)} />
                  <div className="book-shelf-caption">{b.title}</div>
                </div>
              ))}
            </div>
            <div className="book-shelf-plank" aria-hidden />
          </div>
        ))}
      </div>

      {!books.isLoading && dedupedBooks.length === 0 && (
        <div className="glass-panel p-6 text-center text-white">
          <p className="font-display">No books on the shelf yet.</p>
        </div>
      )}

      {/* Watch & Learn — curated YouTube picks */}
      {Array.isArray(videos.data) && videos.data.length > 0 && (
        <section className="pt-2">
          <h2 className="font-display font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] mb-3" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>Watch &amp; Learn</h2>
          <div className="stagger-grid stagger-offset">
            {videos.data.map((v: any) => (
              <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="stagger-cell glass-panel p-4 block">
                <div className="flex items-start gap-3">
                  <span className="text-4xl drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]">📺</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold leading-tight text-white" style={{ fontSize: "1.1rem" }}>{v.title}</div>
                    {v.description && <p className="mt-1 text-white/85 text-sm">{v.description}</p>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Always-available way to find something free to read online. */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-4xl drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]">🌐</span>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-lg text-white">Read free books online</div>
            <p className="text-sm text-white/85">Thousands of free, legal books — right here in the dashboard.</p>
          </div>
          <button className="glass-control glass-control--primary h-9 px-4 text-sm" onClick={() => setReading({ id: -1, title: "", author: "" } as Book)}>
            Browse free books
          </button>
        </div>
      </div>

      <BookDetailDialog book={detail} onClose={() => setDetail(null)} onRead={(b) => { setDetail(null); setReading(b); }} unlocked={unlocked} />
      <OnlineReaderDialog book={reading} onClose={() => setReading(null)} />
      {adding && <AddBookDialog open={adding} onOpenChange={setAdding} />}
    </div>
  );
}
