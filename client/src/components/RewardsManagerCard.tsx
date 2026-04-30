import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const CATEGORIES = ["digital", "cash", "treat", "toy", "experience", "screen_time", "custom"] as const;

const PRESETS: Array<{ slug: string; title: string; emoji: string; coinCost: number; category: typeof CATEGORIES[number]; description: string; img?: string }> = [
  { slug: "extra-screen-30", title: "+30 min screen time", emoji: "📱", coinCost: 15, category: "screen_time", description: "Bonus iPad/tv time after school." },
  { slug: "ice-cream", title: "Ice cream outing", emoji: "🍦", coinCost: 30, category: "treat", description: "Mom-approved sweet treat." },
  { slug: "cake-pop", title: "Starbucks cake pop", emoji: "🍰", coinCost: 25, category: "treat", description: "Pink frosting, sprinkles." },
  { slug: "movie-night", title: "Family movie night", emoji: "🎬", coinCost: 40, category: "experience", description: "You pick the movie!" },
  { slug: "roblox-5", title: "$5 Roblox card", emoji: "🎮", coinCost: 60, category: "digital", description: "Save up for digital fun." },
  { slug: "amazon-10", title: "$10 Amazon choice", emoji: "📦", coinCost: 100, category: "cash", description: "Pick anything under $10." },
  { slug: "stuffie", title: "New stuffed animal", emoji: "🧸", coinCost: 80, category: "toy", description: "Add one to your collection." },
  { slug: "bird-toy", title: "Toy for the parakeets", emoji: "🦜", coinCost: 50, category: "toy", description: "For Kiwi and the flock." },
  { slug: "park-trip", title: "Park / hike trip", emoji: "🌲", coinCost: 35, category: "experience", description: "Pick a park or trail." },
  { slug: "art-supplies", title: "New art supplies", emoji: "🎨", coinCost: 70, category: "toy", description: "Markers, paint, or a sketchbook." },
];

function buildDescription(text: string, img: string): string | null {
  const t = text.trim();
  const i = img.trim();
  if (!t && !i) return null;
  if (i) return JSON.stringify({ img: i, text: t || null });
  return t;
}

export default function RewardsManagerCard() {
  const list = trpc.rewards.listPrizes.useQuery({ activeOnly: false });
  const create = trpc.rewards.createPrize.useMutation({
    onSuccess: () => { list.refetch(); toast.success("Prize added"); },
    onError: (e) => toast.error(e.message || "Couldn't add"),
  });
  const update = trpc.rewards.updatePrize.useMutation({
    onSuccess: () => { list.refetch(); toast.success("Updated"); },
  });
  const remove = trpc.rewards.deletePrize.useMutation({
    onSuccess: () => { list.refetch(); toast.success("Removed"); },
  });

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎁");
  const [coinCost, setCoinCost] = useState(25);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("treat");
  const [text, setText] = useState("");
  const [img, setImg] = useState("");

  const items = Array.isArray(list.data) ? list.data : [];

  function addManual() {
    if (!title.trim()) { toast.error("Title required"); return; }
    create.mutate({
      title: title.trim(),
      emoji: emoji || "🎁",
      coinCost,
      category,
      description: buildDescription(text, img) ?? undefined,
      active: true,
    });
    setTitle(""); setText(""); setImg(""); setCoinCost(25);
  }

  function addPreset(p: typeof PRESETS[number]) {
    create.mutate({
      title: p.title,
      emoji: p.emoji,
      coinCost: p.coinCost,
      category: p.category,
      description: buildDescription(p.description, p.img ?? "") ?? undefined,
      active: true,
    });
  }

  return (
    <Card className="p-4 rounded-2xl">
      <div className="font-semibold text-base mb-1">🎁 Rewards Manager (adult)</div>
      <div className="text-xs opacity-70 mb-4">Reagan's Prize Shop starts empty. Add prizes manually or pick from the preset library below. You can paste an image URL to make a tile look like the real reward.</div>

      {/* Manual create form */}
      <div className="rounded-xl border p-3 mb-4 bg-muted/30">
        <div className="font-semibold text-sm mb-2">Add a custom prize</div>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <Input className="sm:col-span-2" placeholder="Title (e.g. Trampoline park)" value={title} onChange={e => setTitle(e.target.value)} />
          <Input placeholder="Emoji" value={emoji} onChange={e => setEmoji(e.target.value)} />
          <Input type="number" placeholder="Cost" value={coinCost} onChange={e => setCoinCost(Number(e.target.value) || 0)} />
          <select className="rounded-md border bg-background px-2 text-sm" value={category} onChange={e => setCategory(e.target.value as any)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button onClick={addManual} disabled={create.isPending}>Add</Button>
          <Input className="sm:col-span-3" placeholder="Image URL (optional)" value={img} onChange={e => setImg(e.target.value)} />
          <Textarea className="sm:col-span-3" rows={2} placeholder="Description (what Reagan sees)" value={text} onChange={e => setText(e.target.value)} />
        </div>
      </div>

      {/* Preset library */}
      <div className="rounded-xl border p-3 mb-4">
        <div className="font-semibold text-sm mb-2">One-click preset library</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {PRESETS.map(p => {
            const exists = items.some((it: any) => it.title === p.title);
            return (
              <button
                key={p.slug}
                disabled={exists || create.isPending}
                onClick={() => addPreset(p)}
                className={`text-left rounded-lg border p-2 text-xs hover:bg-accent transition ${exists ? "opacity-50" : ""}`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>{p.emoji} {p.title}</span>
                  <span className="text-amber-700 font-bold">🪙 {p.coinCost}</span>
                </div>
                <div className="opacity-70 mt-0.5 line-clamp-2">{p.description}</div>
                {exists && <div className="text-[10px] mt-1 opacity-60">Already added</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Existing prizes */}
      <div className="rounded-xl border p-3">
        <div className="font-semibold text-sm mb-2">Current prizes ({items.length})</div>
        {items.length === 0 && <div className="text-xs opacity-70">None yet.</div>}
        <div className="space-y-1.5">
          {items.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 text-sm border-b pb-1 last:border-0">
              <span className="text-xl">{p.emoji}</span>
              <span className="font-semibold flex-1 truncate">{p.title}</span>
              <span className="text-xs opacity-70">🪙 {p.coinCost}</span>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: p.id, active: !p.active })}>
                {p.active ? "Hide" : "Show"}
              </Button>
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => { if (confirm(`Delete "${p.title}"?`)) remove.mutate({ id: p.id }); }}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
