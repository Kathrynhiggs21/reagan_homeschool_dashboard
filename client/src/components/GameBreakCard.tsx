import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useKiwi } from "@/contexts/KiwiContext";
import { toast } from "sonner";

/**
 * GameBreakCard — surfaces a 10-15 min break when:
 *   • Reagan signals 2+ "Hard" in the last 30 min (frustration break)
 *   • OR she signals 2+ "Got it!" with no Hard (earned reward)
 * Otherwise hides itself. She always sees a kind reason — never "you failed,
 * take a break". Logging the break feeds the parent dashboard.
 */
export default function GameBreakCard() {
  const { companionName, companionAvatar } = useKiwi();
  const mood = trpc.games.moodWindow.useQuery({ windowMin: 30 }, { refetchInterval: 60_000 });
  const games = trpc.games.list.useQuery({ activeOnly: true });
  const utils = trpc.useUtils();
  const logBreak = trpc.games.logBreak.useMutation({
    onSuccess: () => {
      utils.games.recentBreaks.invalidate();
      toast.success(`${companionAvatar} Enjoy your break — set a 10-min timer and come back to me.`, { icon: "💛" });
    },
  });
  const [picked, setPicked] = useState<number | null>(null);

  const reason: "frustrationBreak" | "earnedReward" | null = useMemo(() => {
    const m: any = mood.data;
    if (!m) return null;
    if (m.suggestBreak) return "frustrationBreak";
    if (m.suggestReward) return "earnedReward";
    return null;
  }, [mood.data]);

  if (!reason || games.isLoading) return null;
  const list: any[] = games.data || [];
  if (!list.length) return null;

  const isReward = reason === "earnedReward";
  const palette = isReward
    ? { bg: "#fef9c3", border: "#facc15", title: "#854d0e", body: "#713f12" }
    : { bg: "#dbeafe", border: "#60a5fa", title: "#1e3a8a", body: "#1e40af" };

  return (
    <Card className="overflow-hidden border-l-4" style={{ background: palette.bg, borderLeftColor: palette.border }}>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0" aria-hidden>{isReward ? "🌟" : "🌿"}</span>
          <div className="min-w-0">
            <div className="font-display text-base" style={{ color: palette.title }}>
              {isReward
                ? `Whoa — three "Got it!"s in a row. ${companionName || "Kiwi"} thinks you earned a break.`
                : `${companionName || "Kiwi"} noticed that felt hard. Want to take a 10-min break?`}
            </div>
            <p className="text-sm leading-snug mt-0.5" style={{ color: palette.body }}>
              {isReward
                ? "You built up real confidence. Step away, do something fun, then come back."
                : "It's not a failure to pause — your brain literally learns better after a short break. Pick something:"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {list.map((g) => (
            <button
              key={g.id}
              onClick={() => setPicked(g.id)}
              className="rounded-lg border-2 px-3 py-2 text-sm font-semibold flex items-center gap-2 transition"
              style={{
                background: picked === g.id ? palette.border : "white",
                color: picked === g.id ? "white" : palette.title,
                borderColor: palette.border,
              }}
            >
              <span aria-hidden>{g.emoji}</span>
              <span className="truncate">{g.title}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] italic" style={{ color: palette.body }}>
            {picked
              ? `${list.find((g) => g.id === picked)?.preferredMinutes || 10} min · then back to school`
              : "Pick one — or tell Kiwi 'just keep going'"}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline" className="bg-transparent text-xs h-8"
              style={{ borderColor: palette.border, color: palette.title }}
              onClick={() => mood.refetch()}
            >
              Just keep going
            </Button>
            <Button
              size="sm" disabled={!picked || logBreak.isPending} className="text-xs h-8"
              style={{ background: palette.border, color: "white" }}
              onClick={() => {
                const g = list.find((x) => x.id === picked);
                logBreak.mutate({
                  gamePrefId: picked,
                  reason,
                  durationMinutes: g?.preferredMinutes ?? 10,
                });
                setPicked(null);
              }}
            >
              Start my break →
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
