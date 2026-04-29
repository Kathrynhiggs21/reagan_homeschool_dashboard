import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useKiwi } from "@/contexts/KiwiContext";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import FeedbackChips from "@/components/FeedbackChips";

/**
 * SkillBuilderTile — the daily 15-minute Skill Builder block.
 *
 * Picks the next-up skill from the ladder (lowest-mastery skill in priority
 * subject order: math → ela → science → social studies). Reagan can pick HOW
 * she wants to learn it (story / picture / hands-on / watch / practice) and
 * tell Kiwi how it felt afterward.
 */

const MODES = [
  { slug: "story",   label: "Tell me a story",  emoji: "📖", color: "#a78bfa" },
  { slug: "visual",  label: "Show me a picture", emoji: "🎨", color: "#60a5fa" },
  { slug: "handsOn", label: "Let's try it",     emoji: "🛠",  color: "#fbbf24" },
  { slug: "watch",   label: "Watch a video",    emoji: "▶",  color: "#ef4444" },
  { slug: "practice", label: "Just practice",   emoji: "✏",   color: "#34d399" },
];

export default function SkillBuilderTile() {
  const { companionName, companionAvatar } = useKiwi();
  const next = trpc.skillLadder.nextUp.useQuery({});
  const utils = trpc.useUtils();
  const [showFeedback, setShowFeedback] = useState(false);
  const practice = trpc.skillLadder.practice.useMutation({
    onSuccess: (res: any) => {
      utils.skillLadder.nextUp.invalidate();
      utils.skillLadder.list.invalidate();
      utils.proud.list.invalidate();
      if (res?.leveledUp) {
        toast.success("You moved up a level on this skill — that used to be hard!", { icon: "🌟" });
      } else {
        toast(`${companionAvatar} ${companionName || "Kiwi"}: I saw that effort. That counts.`, { icon: "💛" });
      }
      setShowFeedback(true);
    },
  });

  const [mode, setMode] = useState<string>("story");
  const [adoptedHintFor, setAdoptedHintFor] = useState<number | null>(null);
  const skill: any = next.data;
  const hint = trpc.adapt.hintFor.useQuery(
    { skillLadderId: skill?.id ?? 0 },
    { enabled: !!skill?.id }
  );
  const suggested: string | null = (hint.data as any)?.suggestedMode ?? null;
  const softerNext: boolean = !!(hint.data as any)?.softerNext;
  // Adopt the suggested mode once per skill (no re-render loops)
  useEffect(() => {
    if (skill?.id && suggested && adoptedHintFor !== skill.id) {
      setMode(suggested);
      setAdoptedHintFor(skill.id);
    }
  }, [skill?.id, suggested, adoptedHintFor]);

  if (next.isLoading) return null;
  if (!skill) return null;

  const subjectColor: Record<string, string> = {
    math: "#fbbf24", ela: "#60a5fa", science: "#34d399", ss: "#f472b6",
  };
  const c = subjectColor[skill.subjectSlug] || "#94a3b8";

  return (
    <Card className="classroom-card p-4 space-y-3" style={{ borderTop: `4px solid ${c}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span>15-min Skill Builder · {skill.subjectSlug.toUpperCase()} · {skill.strand}</span>
            {skill._matchedIhWeek && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#e6c20022", color: "#e6c200", border: "1px solid #e6c20055" }}>
                🏫 At Indian Hill this week
              </span>
            )}
          </div>
          <div className="font-display text-lg leading-tight mt-0.5">Today's next step: {skill.title}</div>
          {skill.kidFriendly && (
            <p className="text-sm text-neutral-300 mt-1 leading-snug">{skill.kidFriendly}</p>
          )}
        </div>
        <span className="text-3xl shrink-0" aria-hidden>📈</span>
      </div>

      {/* Mode picker */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pick how you want to learn it</div>
          {suggested && (
            <div className="text-[11px] flex items-center gap-1" title={(hint.data as any)?.reason || ""}>
              <span>💡</span>
              <span className="text-amber-300">Kiwi suggests:</span>
              <span className="font-semibold text-amber-200">{suggested}</span>
              {softerNext && <span className="ml-1 rounded-full bg-amber-500/20 text-amber-200 px-1.5 py-0.5">no level-up pressure</span>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.slug}
              onClick={() => setMode(m.slug)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all"
              style={{
                background: mode === m.slug ? m.color : "transparent",
                color: mode === m.slug ? "#1a1a1a" : "#f7f1e3",
                borderColor: m.color,
              }}
            >
              <span className="mr-1" aria-hidden>{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Show the matching hook */}
      <div className="rounded-md bg-white/5 border border-white/10 p-3 text-sm leading-relaxed">
        {mode === "story"   && (skill.storyHook   || "Ask Kiwi to tell you a story about this skill.")}
        {mode === "visual"  && (skill.visualHook  || "Picture it like this: imagine an example you can see.")}
        {mode === "handsOn" && (skill.handsOnHook || "Try this with something you can hold or move around.")}
        {mode === "watch"   && (skill.khanUrl ? (
          <a href={skill.khanUrl} target="_blank" rel="noreferrer" className="text-amber-400 underline">
            ▶ Open the Khan Academy video for this skill
          </a>
        ) : "No video linked yet — ask Kiwi to find one.")}
        {mode === "practice" && (skill.ixlUrl ? (
          <a href={skill.ixlUrl} target="_blank" rel="noreferrer" className="text-amber-400 underline">
            ✏ Open practice on IXL
          </a>
        ) : "Open your notebook and try a few of these on paper.")}
      </div>

      {/* Self-rating */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Tell Kiwi how it felt:</span>
        <Button size="sm" variant="outline" className="bg-transparent text-xs h-7" disabled={practice.isPending}
          onClick={() => practice.mutate({ skillLadderId: skill.id, mode: mode as any, selfRating: 1 })}>😅 Hard</Button>
        <Button size="sm" variant="outline" className="bg-transparent text-xs h-7" disabled={practice.isPending}
          onClick={() => practice.mutate({ skillLadderId: skill.id, mode: mode as any, selfRating: 3 })}>🌿 Getting it</Button>
        <Button size="sm" className="text-xs h-7" style={{ background: c, color: "#1a1a1a" }} disabled={practice.isPending}
          onClick={() => practice.mutate({ skillLadderId: skill.id, mode: mode as any, selfRating: 5 })}>🌟 Got it!</Button>
        <Link href="/levels" className="ml-auto text-xs text-amber-400 underline">See all my levels →</Link>
      </div>
      {showFeedback && (
        <div className="px-4 pb-4">
          <FeedbackChips skillLadderId={skill.id} onDone={() => setShowFeedback(false)} />
        </div>
      )}
    </Card>
  );
}
