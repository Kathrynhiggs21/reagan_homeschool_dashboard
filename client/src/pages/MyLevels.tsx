import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useKiwi } from "@/contexts/KiwiContext";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * MyLevels — Reagan-friendly progress page.
 *
 * Design rules:
 *   - Don't dump 20 skill cards at once. Show 4 big SUBJECT TILES first.
 *   - Tap a subject -> see only that subject's skills (still tile-style, not list).
 *   - Keep her safe: no scores, no "behind grade level," only her ladder going up.
 *   - Levels 0-5 with kid-friendly names.
 */

const LEVEL_NAMES = [
  { n: 0, label: "Just Starting",        emoji: "🌱", color: "#94a3b8" },
  { n: 1, label: "I Met This",            emoji: "👋", color: "#60a5fa" },
  { n: 2, label: "I'm Trying It",         emoji: "🎯", color: "#a78bfa" },
  { n: 3, label: "Mostly Got It",         emoji: "💪", color: "#fbbf24" },
  { n: 4, label: "I Got This!",           emoji: "🌟", color: "#34d399" },
  { n: 5, label: "I Could Teach Kiwi!",   emoji: "🏆", color: "#f472b6" },
];

type SubjectTile = {
  slug: string;
  label: string;
  emoji: string;
  color: string;
  bgFrom: string;
  bgTo: string;
  blurb: string;
};

const SUBJECTS: SubjectTile[] = [
  { slug: "math",    label: "Math",            emoji: "🔢", color: "#fbbf24", bgFrom: "#fff7d6", bgTo: "#ffd97a", blurb: "Numbers, shapes, patterns." },
  { slug: "ela",     label: "Reading & Writing", emoji: "📖", color: "#60a5fa", bgFrom: "#dceaff", bgTo: "#9ec1ff", blurb: "Books, stories, words." },
  { slug: "science", label: "Science",         emoji: "🔬", color: "#34d399", bgFrom: "#d6f5e3", bgTo: "#86e5b3", blurb: "How the world works." },
  { slug: "ss",      label: "Social Studies",  emoji: "🌎", color: "#f472b6", bgFrom: "#ffdaeb", bgTo: "#ffa9d2", blurb: "People, places, history." },
];

export default function MyLevels() {
  const { companionName, companionAvatar } = useKiwi();
  const [subject, setSubject] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <header>
        <div className="font-chalk-hand text-amber-400 text-lg">Just for you, Reagan</div>
        <h1 className="font-display text-3xl md:text-4xl chalk-white">My Levels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a subject to see your skills. There are no scores — just your ladder going up.
          {" "}{companionName || "Kiwi"} {companionAvatar} is rooting for you.
        </p>
      </header>

      {!subject && <SubjectGrid onPick={setSubject} />}
      {subject && (
        <SubjectView
          subject={SUBJECTS.find((s) => s.slug === subject)!}
          onBack={() => setSubject(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
 * Subject Grid: the simplified "pick a subject" tile gateway
 * ============================================================ */

function SubjectGrid({ onPick }: { onPick: (slug: string) => void }) {
  // Pull a per-subject summary so we can show a friendly progress chip on each tile
  const summaries = trpc.skillLadder.summary.useQuery();

  const summaryFor = (slug: string) => {
    if (!summaries.data) return null;
    return (summaries.data as any[]).find((r) => r.subjectSlug === slug);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {SUBJECTS.map((s) => {
        const sum = summaryFor(s.slug);
        const totalSkills = sum?.skills ?? 0;
        const stars = sum?.mastered ?? 0;
        return (
          <button
            key={s.slug}
            onClick={() => onPick(s.slug)}
            className="text-left rounded-2xl p-5 transition-transform hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-amber-300"
            style={{
              background: `linear-gradient(160deg, ${s.bgFrom} 0%, ${s.bgTo} 100%)`,
              border: `3px solid ${s.color}`,
              boxShadow: `0 6px 24px -10px ${s.color}77, inset 0 0 0 2px rgba(255,255,255,0.5)`,
              color: "#1a1a1a",
            }}
            aria-label={`Open ${s.label} skills`}
          >
            <div className="flex items-center gap-3">
              <div className="text-5xl drop-shadow-sm" aria-hidden>{s.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-2xl leading-tight">{s.label}</div>
                <div className="text-[13px] opacity-80">{s.blurb}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[12px]">
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(255,255,255,0.7)", color: "#1a1a1a" }}
              >
                ⭐ {stars} stars
              </span>
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(255,255,255,0.55)", color: "#1a1a1a" }}
              >
                {totalSkills} skills
              </span>
              <span className="ml-auto opacity-70">Tap to open →</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
 * Subject View: shows only one subject's skills, still tile-y
 * ============================================================ */

function SubjectView({ subject, onBack }: { subject: SubjectTile; onBack: () => void }) {
  const { companionName, companionAvatar } = useKiwi();
  const skills = trpc.skillLadder.list.useQuery({ subjectSlug: subject.slug });
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
    <div className="space-y-4">
      {/* Back + subject banner */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="bg-white/80 text-slate-900">
          ← All subjects
        </Button>
        <div
          className="flex-1 rounded-xl px-4 py-2 flex items-center gap-3"
          style={{
            background: `linear-gradient(135deg, ${subject.bgFrom}, ${subject.bgTo})`,
            border: `2px solid ${subject.color}`,
            color: "#1a1a1a",
          }}
        >
          <div className="text-2xl" aria-hidden>{subject.emoji}</div>
          <div className="font-display text-xl leading-tight">{subject.label}</div>
          <div className="ml-auto text-[12px] font-semibold">⭐ {totalLeveled} stars</div>
        </div>
      </div>

      {skills.isLoading && <div className="text-muted-foreground text-sm">Loading…</div>}
      {!skills.isLoading && (skills.data?.length ?? 0) === 0 && (
        <Card className="classroom-card p-6 text-center">
          <p className="font-display text-base">No skills set up here yet.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {(skills.data || []).map((s: any) => {
          const lvl = s.progress?.level ?? 0;
          const meta = LEVEL_NAMES[lvl] || LEVEL_NAMES[0];
          // pick a representative emoji thumbnail from the skill's visual hook,
          // strand, or fall back to the subject's emoji so every card has a face
          const findEmoji = (str: string | undefined | null): string | undefined => {
            if (!str) return undefined;
            // scan code-points for the common emoji ranges; avoids \p{} flags that
            // require a newer regex target than the project's tsconfig.
            for (const ch of str) {
              const cp = ch.codePointAt(0) || 0;
              if (
                (cp >= 0x1f300 && cp <= 0x1faff) ||
                (cp >= 0x2600 && cp <= 0x27bf)
              ) return ch;
            }
            return undefined;
          };
          const thumb =
            (s.thumbEmoji as string | undefined) ||
            (s.iconEmoji as string | undefined) ||
            findEmoji(s.kidFriendly) ||
            findEmoji(s.visualHook) ||
            subject.emoji;
          return (
            <Card
              key={s.id}
              className="p-3 md:p-4"
              style={{
                background: `linear-gradient(180deg, ${subject.bgFrom}cc, ${subject.bgTo}66)`,
                border: `2px solid ${subject.color}`,
                color: "#1a1a1a",
              }}
            >
              <div className="flex items-stretch gap-3">
                {/* big emoji thumbnail on the left so Reagan can recognize the skill at a glance */}
                <div
                  className="shrink-0 flex items-center justify-center rounded-xl"
                  style={{
                    width: 86,
                    height: 86,
                    background: `linear-gradient(160deg, ${subject.bgTo}, ${subject.bgFrom})`,
                    border: `2px solid ${subject.color}`,
                    boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.6), 0 6px 16px -8px ${subject.color}99`,
                    fontSize: 44,
                    lineHeight: 1,
                  }}
                  aria-hidden
                >
                  {thumb}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] uppercase tracking-wider opacity-70">{s.strand}</div>
                      <div className="font-display text-base md:text-lg leading-tight mt-0.5 text-slate-900">{s.title}</div>
                      {s.kidFriendly && (
                        <p className="text-[13px] mt-1 leading-snug text-slate-800">{s.kidFriendly}</p>
                      )}
                    </div>
                    <div className="text-2xl shrink-0" aria-hidden>{meta.emoji}</div>
                  </div>

              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className="h-2.5 rounded-full flex-1 transition-all"
                    style={{
                      background: n <= lvl ? meta.color : "rgba(0,0,0,0.12)",
                      boxShadow: n <= lvl ? `0 0 8px ${meta.color}88` : "none",
                    }}
                    aria-label={`Level ${n} ${n <= lvl ? "filled" : "empty"}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                {s.progress?.lastPracticedAt && (
                  <span className="opacity-70">
                    Last tried: {new Date(s.progress.lastPracticedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

                </div>
              </div>
              {(s.storyHook || s.visualHook || s.handsOnHook) && (
                <details className="mt-1">
                  <summary className="text-[12px] font-semibold cursor-pointer select-none" style={{ color: subject.color }}>
                    Show me a way to get this →
                  </summary>
                  <div className="mt-2 space-y-1.5 text-[13px] text-slate-800">
                    {s.storyHook && (<div><span className="font-semibold">📖 Story:</span> {s.storyHook}</div>)}
                    {s.visualHook && (<div><span className="font-semibold">🎨 Picture:</span> {s.visualHook}</div>)}
                    {s.handsOnHook && (<div><span className="font-semibold">🛠 Try it:</span> {s.handsOnHook}</div>)}
                    {s.khanUrl && (<a href={s.khanUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: subject.color }}>▶ Watch on Khan Academy</a>)}
                    {s.khanUrl && s.ixlUrl && " · "}
                    {s.ixlUrl && (<a href={s.ixlUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: subject.color }}>✏ Practice on IXL</a>)}
                  </div>
                </details>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white/80 text-slate-900 text-xs h-7"
                  disabled={practice.isPending}
                  onClick={() => practice.mutate({ skillLadderId: s.id, mode: "practice", selfRating: 2 })}
                >
                  🟡 I tried it
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white/80 text-slate-900 text-xs h-7"
                  disabled={practice.isPending}
                  onClick={() => practice.mutate({ skillLadderId: s.id, mode: "practice", selfRating: 3 })}
                >
                  🌿 I'm getting it
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-7"
                  style={{ background: meta.color, color: "#1a1a1a" }}
                  disabled={practice.isPending}
                  onClick={() => practice.mutate({ skillLadderId: s.id, mode: "practice", selfRating: 5 })}
                >
                  🌟 I got it!
                </Button>
              </div>
              </Card>
          );
        })}
      </div>
    </div>
  );
}
