import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdultLock } from "@/contexts/AdultLockContext";
import { toast } from "sonner";

type App = { id: number; name: string; url: string; category: string | null; emoji?: string | null; description?: string | null; accountInfo?: string | null };

const CATEGORY_ORDER: { key: string; label: string; subtitle?: string }[] = [
  { key: "school", label: "School", subtitle: "Your daily drivers" },
  { key: "google", label: "Google", subtitle: "Classroom, Docs, Drive, Gmail" },
  { key: "reading", label: "Reading", subtitle: "Books & passages" },
  { key: "video", label: "Videos", subtitle: "Learning channels" },
  { key: "nature", label: "Nature", subtitle: "Birds, plants, space" },
  { key: "creativity", label: "Create", subtitle: "Design & make" },
  { key: "learning", label: "More", subtitle: "Everything else" },
];

const CAT_COLOR: Record<string, string> = {
  school: "chip-cyan",
  google: "chip-violet",
  reading: "chip-pink",
  video: "chip-coral",
  nature: "chip-lime",
  creativity: "chip-orange",
  learning: "chip-yellow",
};

const CATEGORIES = ["learning","creativity","school","nature","reading"] as const;

function AppForm({ open, onOpenChange, app }: any) {
  const utils = trpc.useUtils();
  const create = trpc.appLinks.create.useMutation();
  const update = trpc.appLinks.update.useMutation();
  const isEdit = !!app;
  const [name, setName] = useState(app?.name || "");
  const [url, setUrl] = useState(app?.url || "");
  const [emoji, setEmoji] = useState(app?.emoji || "🔗");
  const [category, setCategory] = useState<string>(app?.category || "learning");
  async function save() {
    if (!name.trim() || !url.trim()) return toast.error("Name and URL required.");
    try {
      if (isEdit) await update.mutateAsync({ id: app.id, name, url, emoji, category: category as any });
      else await create.mutateAsync({ name, url, emoji, category: category as any } as any);
      utils.appLinks.list.invalidate();
      toast.success(isEdit ? "App updated" : "App added");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit app" : "Add app"}</DialogTitle></DialogHeader>
        <div className="space-y-2 pt-2">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="URL (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Input placeholder="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" className="bg-transparent" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Apps() {
  const { unlocked } = useAdultLock();
  const utils = trpc.useUtils();
  const apps = trpc.appLinks.list.useQuery();
  const list = (apps.data ?? []) as App[];
  const del = trpc.appLinks.delete.useMutation({ onSuccess: () => utils.appLinks.list.invalidate() });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<App | null>(null);

  const grouped: Record<string, App[]> = {};
  for (const a of list) {
    const k = (a.category || "learning").toLowerCase();
    (grouped[k] ||= []).push(a);
  }
  const orderedKeys = [
    ...CATEGORY_ORDER.map(c => c.key).filter(k => grouped[k]?.length),
    ...Object.keys(grouped).filter(k => !CATEGORY_ORDER.some(c => c.key === k)),
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-chalk-hand text-xl leading-none chalk-yellow">Everything you need</div>
          <h1 className="font-display text-4xl md:text-5xl mt-1 chalk-white">Apps &amp; Tools</h1>
          <p className="text-sm text-muted-foreground mt-2">Tap a tile to open it in a new tab.</p>
        </div>
        {unlocked && (
          <Button size="sm" onClick={() => setAdding(true)}>+ Add app</Button>
        )}
      </header>

      {apps.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {orderedKeys.map((key) => {
        const meta = CATEGORY_ORDER.find(c => c.key === key);
        const items = grouped[key];
        return (
          <section key={key} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold chalk-white">{meta?.label || key}</h2>
              {meta?.subtitle && (
                <span className="text-xs text-muted-foreground">{meta.subtitle}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((a) => (
                <div key={a.id} className="group relative">
                  <a href={a.url} target="_blank" rel="noreferrer" aria-label={a.name}>
                    <Card className="classroom-card p-5 h-full flex flex-col items-center justify-center text-center gap-2 hover:-translate-y-1 hover:shadow-lg transition-all min-h-[140px]">
                      <span
                        className={`time-chip ${CAT_COLOR[key] || "chip-yellow"} !w-20 !h-20 !text-5xl !rounded-2xl shrink-0 flex items-center justify-center`}
                        aria-hidden
                      >
                        {a.emoji || "✨"}
                      </span>
                      <div className="font-display font-semibold text-[15px] leading-tight">{a.name}</div>
                      <div className="text-[10px] text-neutral-500 truncate w-full">
                        {(() => { try { return new URL(a.url).hostname.replace(/^www\./, ""); } catch { return a.url; } })()}
                      </div>
                    </Card>
                  </a>
                  {unlocked && (
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.preventDefault(); setEditing(a); }}
                        className="bg-card border rounded px-1.5 text-xs hover:bg-accent"
                        aria-label="Edit"
                      >✎</button>
                      <button
                        onClick={async (e) => { e.preventDefault(); if (confirm(`Delete "${a.name}"?`)) { await del.mutateAsync({ id: a.id }); toast.success("App removed"); } }}
                        className="bg-card border rounded px-1.5 text-xs hover:bg-destructive/10 text-destructive"
                        aria-label="Delete"
                      >🗑</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {!apps.isLoading && list.length === 0 && (
        <Card className="classroom-card p-6 text-center">
          <p className="font-display">No apps yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Adults can add apps with the + Add app button.</p>
        </Card>
      )}

      {adding && <AppForm open={adding} onOpenChange={setAdding} />}
      {editing && <AppForm open={!!editing} onOpenChange={(o: boolean) => !o && setEditing(null)} app={editing} />}
    </div>
  );
}
