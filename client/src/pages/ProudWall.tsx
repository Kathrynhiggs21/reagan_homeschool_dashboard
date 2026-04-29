import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKiwi } from "@/contexts/KiwiContext";
import { useState } from "react";
import { toast } from "sonner";

/**
 * ProudWall — "Things I'm Proud Of" wall.
 *
 * Confidence Engine surface. Lists every proud moment Kiwi, parents, tutors, or
 * Reagan herself has logged. Reagan can tap a heart on any moment that lands.
 * Quick-add form lets her record her own "I did this!" in one sentence.
 */

const QUICK_CATEGORIES = [
  { slug: "effort",      label: "I worked hard",       emoji: "💪", color: "#fbbf24" },
  { slug: "skill",       label: "I learned something", emoji: "🧠", color: "#60a5fa" },
  { slug: "kindness",    label: "I was kind",          emoji: "💛", color: "#f472b6" },
  { slug: "bravery",     label: "I was brave",         emoji: "🦁", color: "#f97316" },
  { slug: "creativity",  label: "I made something",    emoji: "🎨", color: "#a78bfa" },
  { slug: "persistence", label: "I didn't give up",    emoji: "🪜", color: "#34d399" },
  { slug: "growth",      label: "I leveled up",        emoji: "📈", color: "#22c55e" },
  { slug: "wonder",      label: "I noticed something", emoji: "🔭", color: "#06b6d4" },
];

export default function ProudWall() {
  const { companionName, companionAvatar } = useKiwi();
  const moments = trpc.proud.list.useQuery({ limit: 100 });
  const utils = trpc.useUtils();

  const add = trpc.proud.add.useMutation({
    onSuccess: () => {
      utils.proud.list.invalidate();
      toast.success("Added to your Proud Wall!", { icon: "🌟" });
      setTitle("");
      setCat("effort");
    },
  });
  const heart = trpc.proud.heart.useMutation({
    onSuccess: () => utils.proud.list.invalidate(),
  });

  const [title, setTitle] = useState("");
  const [cat, setCat] = useState<string>("effort");

  return (
    <div className="space-y-6">
      <header>
        <div className="font-chalk-hand text-pink-400 text-lg">Just for you, Reagan</div>
        <h1 className="font-display text-3xl md:text-4xl chalk-white">Things I'm Proud Of</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Big or tiny — anything you did that you feel good about belongs here. {companionName || "Kiwi"} adds to
          this wall too, when she sees you do something brave or smart.
        </p>
      </header>

      {/* Quick add */}
      <Card className="classroom-card p-4 space-y-3 border-2 border-pink-300/40">
        <div className="font-display text-base">Add something I did</div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. I figured out a hard math problem all by myself"
          className="text-base"
          maxLength={200}
        />
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CATEGORIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCat(c.slug)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all"
              style={{
                background: cat === c.slug ? c.color : "transparent",
                color: cat === c.slug ? "#1a1a1a" : "#f7f1e3",
                borderColor: c.color,
              }}
            >
              <span className="mr-1" aria-hidden>{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>
        <Button
          className="bg-pink-400 hover:bg-pink-500 text-pink-950 font-semibold w-full"
          disabled={!title.trim() || add.isPending}
          onClick={() => add.mutate({
            title: title.trim(),
            source: "reagan",
            category: cat as any,
            emoji: QUICK_CATEGORIES.find(c => c.slug === cat)?.emoji,
          })}
        >
          🌟 Put it on my wall
        </Button>
      </Card>

      {/* Wall */}
      {moments.isLoading && <div className="text-muted-foreground text-sm">Loading…</div>}
      {!moments.isLoading && (moments.data?.length ?? 0) === 0 && (
        <Card className="classroom-card p-6 text-center">
          <div className="text-3xl mb-1" aria-hidden>🌟</div>
          <p className="font-display text-base">Your wall is empty for now.</p>
          <p className="text-sm text-muted-foreground mt-1">Add the first one above — it counts.</p>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(moments.data || []).map((m: any) => {
          const meta = QUICK_CATEGORIES.find((c) => c.slug === m.category) || QUICK_CATEGORIES[0];
          const sourceLabel: Record<string, string> = {
            reagan: "From me",
            kiwi: `From ${companionName || "Kiwi"}`,
            parent: "From Mom",
            tutor: "From my tutor",
            auto: "Spotted automatically",
          };
          return (
            <Card key={m.id} className="classroom-card p-3 space-y-2" style={{ borderTop: `3px solid ${meta.color}` }}>
              <div className="flex items-start gap-2">
                <span className="text-2xl shrink-0" aria-hidden>{m.emoji || meta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[14px] leading-snug">{m.title}</div>
                  {m.body && <p className="text-[12px] text-neutral-300 mt-0.5 leading-snug">{m.body}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{sourceLabel[m.source] || m.source}</span>
                <button
                  className="flex items-center gap-1 hover:text-pink-400 transition"
                  onClick={() => heart.mutate({ id: m.id })}
                  aria-label="I love this one"
                  title="I love this"
                >
                  <span className="text-base">{m.reaganHearted ? "💖" : "🤍"}</span>
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="text-center text-xs text-muted-foreground italic pt-3">
        {companionAvatar} Reagan, when you tap the heart it means "yes, this one matters to me."
      </div>
    </div>
  );
}
