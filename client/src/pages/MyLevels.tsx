import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useKiwi } from "@/contexts/KiwiContext";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * MyLevels — Reagan's view of her own progress.
 *
 * Design rules (re-anchor: feel safe, feel smart):
 *   • NEVER show absolute grade level or "behind grade level" labels.
 *   • Show ONLY her ladder going up. The point of comparison is her past self.
 *   • Levels are 0-5 with kid-friendly names (Just Starting → I Got It!).
 *   • She can tap "I tried this!" or "I'm getting it!" to log practice — never
 *     a wrong answer, never a score.
 *   • Visual emphasis: filled level pips, bright color when she levels up.
 */

const LEVEL_NAMES = [
  { n: 0, label: "Just Starting",   emoji: "🌱", color: "#94a3b8" },
  { n: 1, label: "I Met This",      emoji: "👋", color: "#60a5fa" },
  { n: 2, label: "I'm Trying It",   emoji: "🎯", color: "#a78bfa" },
  { n: 3, label: "Mostly Got It",   emoji: "💪", color: "#fbbf24" },
  { n: 4, label: "I Got This!",     emoji: "🌟", color: "#34d399" },
  { n: 5, label: "I Could Teach Kiwi!", emoji: "🏆", color: "#f472b6" },
];

const SUBJECT_PILLS: { slug: string; label: string; emoji: string; color: string }[] = [
  { slug: "math",    label: "Math",            emoji: "🔢", color: "#fbbf24" },
  { slug: "ela",     label: "Reading & Writing", emoji: "📖", color: "#60a5fa" },
  { slug: "science", label: "Science",         emoji: "🔬", color: "#34d399" },
  { slug: "ss",      label: "Social Studies",  emoji: "🌎", color: "#f472b6" },
];

export default function MyLevels() {
  const { companionName, companionAvatar } = useKiwi();
  const [subject, setSubject] = useState<string>("math");
  const skills = trpc.skillLadder.list.useQuery({ subjectSlug: subject });
  const utils = trpc.useUtils();
  const practice = trpc.skillLadder.practice.useMutation({
    onSuccess: (res: any) => {
      utils.skillLadder.list.invalidate();
      utils.skillLadder.summary.invalidate();
      utils.proud.list.invalidate();
      if (res?.leveledUp) {
        toast.success("You moved up a level! Look at you go.", { icon: "🌟" });
      } else {
        toast(`${companionAvatar} ${companionName || "Kiwi"}: I saw that effort!`, { icon: "💛" });
      }
    },
  });

  const totalLeveled = useMemo(() => {
    return (skills.data || []).reduce((acc: number, s: any) => acc + (s.progress?.level ?? 0), 0);
  }, [skills.data]);

  return (
    <div className="space-y-6">
      <header>
        <div className="font-chalk-hand text-amber-400 text-lg">Just for you, Reagan</div>
        <h1 className="font-display text-3xl md:text-4xl chalk-white">My Levels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every skill has a level. The more you practice, the higher it goes. There are no scores here — just your
          progress. {companionName || "Kiwi"} is rooting for you.
        </p>
      </header>

      {/* Subject pills */}
      <div className="flex flex-wrap gap-2">
        {SUBJECT_PILLS.map((p) => (
          <button
            key={p.slug}
            onClick={() => setSubject(p.slug)}
            className="px-3 py-1.5 rounded-full font-display text-sm transition-all border-2"
            style={{
              background: subject === p.slug ? p.color : "transparent",
              color: subject === p.slug ? "#1a1a1a" : "#f7f1e3",
              borderColor: p.color,
            }}
          >
            <span className="mr-1.5" aria-hidden>{p.emoji}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary strip */}
      <Card className="classroom-card p-4 flex items-center gap-3">
        <div className="text-3xl" aria-hidden>📈</div>
        <div className="flex-1">
          <div className="font-display text-lg">
            You've leveled up <span className="text-amber-400">{totalLeveled}</span> times in {SUBJECT_PILLS.find(p => p.slug === subject)?.label}.
          </div>
          <div className="text-xs text-muted-foreground">Every star you fill is something you can DO that you couldn't before.</div>
        </div>
      </Card>

      {skills.isLoading && <div className="text-muted-foreground text-sm">Loading…</div>}
      {!skills.isLoading && (skills.data?.length ?? 0) === 0 && (
        <Card className="classroom-card p-6 text-center">
          <p className="font-display text-base">No skills set up here yet.</p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {(skills.data || []).map((s: any) => {
          const lvl = s.progress?.level ?? 0;
          const meta = LEVEL_NAMES[lvl] || LEVEL_NAMES[0];
          return (
            <Card key={s.id} className="classroom-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.strand}</div>
                  <div className="font-display text-base leading-tight mt-0.5">{s.title}</div>
                  {s.kidFriendly && (
                    <p className="text-[13px] text-neutral-300 mt-1 leading-snug">{s.kidFriendly}</p>
                  )}
                </div>
                <div className="text-2xl shrink-0" aria-hidden>{meta.emoji}</div>
              </div>

              {/* Level pips */}
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className="h-2.5 rounded-full flex-1 transition-all"
                    style={{
                      background: n <= lvl ? meta.color : "rgba(255,255,255,0.08)",
                      boxShadow: n <= lvl ? `0 0 8px ${meta.color}55` : "none",
                    }}
                    aria-label={`Level ${n} ${n <= lvl ? "filled" : "empty"}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                {s.progress?.lastPracticedAt && (
                  <span className="text-muted-foreground">
                    Last tried: {new Date(s.progress.lastPracticedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Multi-modal hooks (optional) */}
              {(s.storyHook || s.visualHook || s.handsOnHook) && (
                <details className="mt-1">
                  <summary className="text-[12px] text-amber-400 cursor-pointer select-none">
                    Show me a way to get this →
                  </summary>
                  <div className="mt-2 space-y-1.5 text-[13px] text-neutral-200">
                    {s.storyHook && (<div><span className="font-semibold">📖 Story:</span> {s.storyHook}</div>)}
                    {s.visualHook && (<div><span className="font-semibold">🎨 Picture:</span> {s.visualHook}</div>)}
                    {s.handsOnHook && (<div><span className="font-semibold">🛠 Try it:</span> {s.handsOnHook}</div>)}
                    {s.khanUrl && (<a href={s.khanUrl} target="_blank" rel="noreferrer" className="text-amber-400 underline">▶ Watch on Khan Academy</a>)}
                    {s.khanUrl && s.ixlUrl && " · "}
                    {s.ixlUrl && (<a href={s.ixlUrl} target="_blank" rel="noreferrer" className="text-amber-400 underline">✏ Practice on IXL</a>)}
                  </div>
                </details>
              )}

              {/* Practice buttons (no scoring, no wrong) */}
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent text-xs h-7"
                  disabled={practice.isPending}
                  onClick={() => practice.mutate({ skillLadderId: s.id, mode: "practice", selfRating: 2 })}
                  title="I tried it but it was hard"
                >
                  🟡 I tried it
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent text-xs h-7"
                  disabled={practice.isPending}
                  onClick={() => practice.mutate({ skillLadderId: s.id, mode: "practice", selfRating: 3 })}
                  title="I'm getting the hang of it"
                >
                  🌿 I'm getting it
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-7"
                  style={{ background: meta.color, color: "#1a1a1a" }}
                  disabled={practice.isPending}
                  onClick={() => practice.mutate({ skillLadderId: s.id, mode: "practice", selfRating: 5 })}
                  title="I really got this!"
                >
                  🌟 I got it!
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="text-center text-xs text-muted-foreground italic pt-3">
        Reagan, every time you tap a button here you're telling Kiwi how it feels — never wrong, never graded.
      </div>
    </div>
  );
}
