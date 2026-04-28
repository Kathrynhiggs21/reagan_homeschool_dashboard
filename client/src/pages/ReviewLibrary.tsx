import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const KIND_OPTIONS = [
  { value: "youtube",   label: "YouTube video" },
  { value: "webpage",   label: "Webpage" },
  { value: "app",       label: "App link" },
  { value: "printable", label: "Printable" },
  { value: "practice",  label: "Practice set" },
  { value: "game",      label: "Game" },
];

const SUBJECTS = [
  "brain-break", "reading", "writing", "math", "science",
  "social-studies", "art", "music", "life-skills", "health",
];

export default function ReviewLibrary() {
  const list = trpc.review.list.useQuery({ approvedOnly: false });
  const rows = Array.isArray(list.data) ? list.data : [];
  const utils = trpc.useUtils();
  const approve = trpc.review.approve.useMutation({
    onSuccess: () => utils.review.list.invalidate(),
  });
  const remove = trpc.review.remove.useMutation({
    onSuccess: () => { utils.review.list.invalidate(); toast.success("Removed."); },
  });
  const add = trpc.review.add.useMutation({
    onSuccess: () => { utils.review.list.invalidate(); toast.success("Added."); setForm(DEFAULT_FORM); },
  });
  const seed = trpc.review.seedStarter.useMutation({
    onSuccess: (r: any) => {
      utils.review.list.invalidate();
      toast.success(r?.seeded ? `Seeded ${r.count} starter picks.` : "Already seeded.");
    },
  });

  const DEFAULT_FORM = {
    title: "", topic: "", kind: "youtube",
    subjectSlug: "brain-break", youtubeId: "", url: "", description: "", approved: true,
  };
  const [form, setForm] = useState(DEFAULT_FORM);

  const submit = () => {
    if (!form.title.trim() || !form.topic.trim()) {
      toast.error("Title and topic are required.");
      return;
    }
    add.mutate({
      title: form.title.trim(),
      topic: form.topic.trim(),
      kind: form.kind as any,
      subjectSlug: form.subjectSlug || null,
      youtubeId: form.kind === "youtube" ? (form.youtubeId.trim() || null) : null,
      url: form.kind !== "youtube" ? (form.url.trim() || null) : null,
      description: form.description.trim() || null,
      approved: form.approved,
    });
  };

  return (
    <div className="space-y-4 pb-16">
      <div>
        <h1 className="font-display text-3xl font-bold">Review Library</h1>
        <p className="text-sm text-muted-foreground">
          Manage the Classroom TV picks + web resources Reagan can access.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <div className="font-display font-semibold">Add a new pick</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Topic (e.g. math, birds, movement)" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.subjectSlug} onValueChange={(v) => setForm({ ...form, subjectSlug: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {form.kind === "youtube" ? (
            <Input placeholder="YouTube ID (e.g. dQw4w9WgXcQ)" value={form.youtubeId} onChange={(e) => setForm({ ...form, youtubeId: e.target.value })} />
          ) : (
            <Input placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.approved} onChange={(e) => setForm({ ...form, approved: e.target.checked })} />
            Approved (visible to Reagan right away)
          </label>
        </div>
        <Textarea placeholder="Short description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex gap-2">
          <Button onClick={submit} disabled={add.isPending}>Add pick</Button>
          <Button variant="secondary" onClick={() => seed.mutate()} disabled={seed.isPending}>
            Seed starter picks
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <div className="font-display text-lg font-semibold">
          {rows.length} resource{rows.length === 1 ? "" : "s"}
        </div>
        {list.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!list.isLoading && rows.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No resources yet. Add one above, or hit "Seed starter picks".
          </Card>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          {rows.map((r: any) => (
            <Card key={r.id} className="p-3 flex gap-3">
              {r.kind === "youtube" && r.youtubeId && (
                <img
                  src={`https://i.ytimg.com/vi/${r.youtubeId}/default.jpg`}
                  alt=""
                  className="w-24 h-18 rounded-lg object-cover shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {r.kind} · {r.topic}{r.subjectSlug ? ` · ${r.subjectSlug}` : ""}
                </div>
                <div className="font-semibold line-clamp-2">{r.title}</div>
                {r.description && <div className="text-xs text-muted-foreground line-clamp-2">{r.description}</div>}
                <div className="flex gap-1 mt-2 items-center">
                  {r.approved ? (
                    <span className="text-[11px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">approved</span>
                  ) : (
                    <span className="text-[11px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">pending</span>
                  )}
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => approve.mutate({ id: r.id, approved: !r.approved })}
                    >
                      {r.approved ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { if (confirm("Delete?")) remove.mutate({ id: r.id }); }}
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
