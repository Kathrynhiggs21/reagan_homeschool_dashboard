/**
 * QuickAddFab — adult-only floating "+ Quick Add" button.
 * Keyboard shortcut "A" opens the menu (if the AdultLock is unlocked and we're not focused in an input).
 * Supports: Today block / To-Do (needs-work) / Timeline event / Note / Adventure / Book / App link / Academic record.
 */
import { useEffect, useState } from "react";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type QuickType = "block" | "needs" | "timeline" | "note" | "book" | "app" | "academic";

const TYPES: { v: QuickType; label: string; emoji: string }[] = [
  { v: "block",    label: "Today block",  emoji: "📝" },
  { v: "needs",    label: "Needs-Work item", emoji: "🌳" },
  { v: "timeline", label: "Timeline event", emoji: "🕰️" },
  { v: "note",     label: "Note",          emoji: "🗒️" },
  { v: "book",     label: "Book",          emoji: "📚" },
  { v: "app",      label: "App / link",    emoji: "🧰" },
  { v: "academic", label: "Academic record", emoji: "🗂️" },
];

export default function QuickAddFab() {
  const { unlocked } = useAdultLock();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<QuickType | null>(null);

  // keyboard "A"
  useEffect(() => {
    if (!unlocked) return;
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "a") return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [unlocked]);

  if (!unlocked) return null;

  return (
    <>
      <Button
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Quick Add"
      >
        + Quick Add (A)
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setKind(null); }}>
        <DialogContent className="max-w-lg">
          {!kind ? (
            <>
              <DialogHeader><DialogTitle>Quick Add</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {TYPES.map((t) => (
                  <Card
                    key={t.v}
                    className="p-3 cursor-pointer hover:bg-accent/40"
                    onClick={() => setKind(t.v)}
                  >
                    <div className="text-2xl">{t.emoji}</div>
                    <div className="text-sm font-medium mt-1">{t.label}</div>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <QuickForm kind={kind} onDone={() => { setOpen(false); setKind(null); }} onBack={() => setKind(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuickForm({ kind, onDone, onBack }: { kind: QuickType; onDone: () => void; onBack: () => void }) {
  const utils = trpc.useUtils();

  if (kind === "block") return <BlockForm onDone={() => { utils.plans.today.invalidate(); toast.success("Block added."); onDone(); }} onBack={onBack} />;
  if (kind === "needs") return <NeedsForm onDone={() => { utils.needsWork.list.invalidate(); toast.success("Added to Needs Work."); onDone(); }} onBack={onBack} />;
  if (kind === "timeline") return <TimelineForm onDone={() => { utils.timeline.list.invalidate(); toast.success("Timeline event added."); onDone(); }} onBack={onBack} />;
  if (kind === "note") return <NoteForm onDone={() => { utils.notes.list.invalidate(); toast.success("Note added."); onDone(); }} onBack={onBack} />;
  if (kind === "book") return <BookForm onDone={() => { utils.books.list.invalidate(); toast.success("Book added."); onDone(); }} onBack={onBack} />;
  if (kind === "app") return <AppLinkForm onDone={() => { utils.appLinks.list.invalidate(); toast.success("App added."); onDone(); }} onBack={onBack} />;
  if (kind === "academic") return <AcademicForm onDone={() => { utils.academics.list.invalidate(); toast.success("Record filed."); onDone(); }} onBack={onBack} />;
  return null;
}

function FormShell({ title, onBack, children, onSave, busy }: any) {
  return (
    <>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <div className="space-y-2 pt-2">{children}</div>
      <DialogFooter className="gap-2">
        <Button variant="outline" className="bg-transparent" onClick={onBack}>Back</Button>
        <Button onClick={onSave} disabled={busy}>Save</Button>
      </DialogFooter>
    </>
  );
}

function BlockForm({ onDone, onBack }: any) {
  const today = trpc.plans.today.useQuery();
  const create = trpc.blocks.create.useMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState(20);
  const [subjectId, setSubjectId] = useState<string>("");
  const subjects = trpc.subjects.list.useQuery();

  async function save() {
    const planId = (today.data as any)?.plan?.id;
    if (!planId) return toast.error("Today's plan isn't ready.");
    if (!title.trim()) return toast.error("Enter a title.");
    await create.mutateAsync({
      planId, blockType: "school", title, description, durationMin,
      subjectId: subjectId ? Number(subjectId) : undefined,
    } as any);
    onDone();
  }
  return (
    <FormShell title="Add Today block" onBack={onBack} busy={create.isPending} onSave={save}>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="flex gap-2">
        <Input type="number" className="w-28" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Subject (optional)" /></SelectTrigger>
          <SelectContent>
            {(subjects.data as any[] || []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </FormShell>
  );
}

function NeedsForm({ onDone, onBack }: any) {
  const create = trpc.needsWork.create.useMutation();
  const [title, setTitle] = useState("");
  const [subjectSlug, setSubjectSlug] = useState("");
  const [note, setNote] = useState("");
  async function save() {
    if (!title.trim()) return toast.error("Enter a title.");
    await create.mutateAsync({ title, subjectSlug: subjectSlug || undefined, note: note || undefined, origin: "manual" } as any);
    onDone();
  }
  return (
    <FormShell title="Add Needs-Work item" onBack={onBack} busy={create.isPending} onSave={save}>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Subject slug (math/ela/science/ss/…)" value={subjectSlug} onChange={(e) => setSubjectSlug(e.target.value)} />
      <Textarea placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
    </FormShell>
  );
}

function TimelineForm({ onDone, onBack }: any) {
  const create = trpc.timeline.add.useMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventType, setEventType] = useState<string>("milestone");
  async function save() {
    if (!title.trim()) return toast.error("Enter a title.");
    await create.mutateAsync({ date, eventType: eventType as any, title, description } as any);
    onDone();
  }
  return (
    <FormShell title="Add Timeline event" onBack={onBack} busy={create.isPending} onSave={save}>
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Select value={eventType} onValueChange={setEventType}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {["completion","milestone","creation","field_trip","reflection","adventure"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
        </SelectContent>
      </Select>
      <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
    </FormShell>
  );
}

function NoteForm({ onDone, onBack }: any) {
  const create = trpc.notes.create.useMutation();
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [subjectSlug, setSubjectSlug] = useState("");
  async function save() {
    if (!title.trim()) return toast.error("Enter a title.");
    await create.mutateAsync({ title, contentText, subjectSlug: subjectSlug || undefined, type: "typed" } as any);
    onDone();
  }
  return (
    <FormShell title="Quick Note" onBack={onBack} busy={create.isPending} onSave={save}>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Subject slug (optional)" value={subjectSlug} onChange={(e) => setSubjectSlug(e.target.value)} />
      <Textarea rows={4} placeholder="Note" value={contentText} onChange={(e) => setContentText(e.target.value)} />
    </FormShell>
  );
}

function BookForm({ onDone, onBack }: any) {
  const create = trpc.books.create.useMutation();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [totalPages, setTotalPages] = useState(100);
  async function save() {
    if (!title.trim()) return toast.error("Enter a title.");
    await create.mutateAsync({ title, author, totalPages, currentPage: 1, type: "novel" } as any);
    onDone();
  }
  return (
    <FormShell title="Add Book" onBack={onBack} busy={create.isPending} onSave={save}>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <Input type="number" placeholder="Total pages" value={totalPages} onChange={(e) => setTotalPages(Number(e.target.value))} />
    </FormShell>
  );
}

function AppLinkForm({ onDone, onBack }: any) {
  const create = trpc.appLinks.create.useMutation();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [emoji, setEmoji] = useState("🔗");
  const [category, setCategory] = useState<string>("learning");
  async function save() {
    if (!name.trim() || !url.trim()) return toast.error("Name and URL required.");
    await create.mutateAsync({ name, url, emoji, category: category as any } as any);
    onDone();
  }
  return (
    <FormShell title="Add App / Link" onBack={onBack} busy={create.isPending} onSave={save}>
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="URL (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Input placeholder="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {["learning","creativity","school","nature","reading"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
        </SelectContent>
      </Select>
    </FormShell>
  );
}

function AcademicForm({ onDone, onBack }: any) {
  const create = trpc.academics.create.useMutation();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [kind, setKind] = useState<string>("assignment");
  const [subjectSlug, setSubjectSlug] = useState("");
  const [scoreText, setScoreText] = useState("");
  async function save() {
    if (!title.trim()) return toast.error("Enter a title.");
    await create.mutateAsync({
      source: "manual", kind: kind as any, title, summary: summary || undefined,
      subjectSlug: subjectSlug || undefined, scoreText: scoreText || undefined,
    } as any);
    onDone();
  }
  return (
    <FormShell title="File Academic Record" onBack={onBack} busy={create.isPending} onSave={save}>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex gap-2">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["assignment","grade","mastery","note","attendance"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Subject slug" value={subjectSlug} onChange={(e) => setSubjectSlug(e.target.value)} />
      </div>
      <Input placeholder="Score text (e.g. 18/20, A)" value={scoreText} onChange={(e) => setScoreText(e.target.value)} />
      <Textarea placeholder="Summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
    </FormShell>
  );
}
