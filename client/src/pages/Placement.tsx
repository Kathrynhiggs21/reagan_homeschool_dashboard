import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useKiwi } from "@/contexts/KiwiContext";
import { toast } from "sonner";
import { Link } from "wouter";

/**
 * Placement — a low-pressure diagnostic walkthrough.
 *
 * Reagan never sees a score, percent correct, or a "wrong" mark. She sees
 * only encouragement and the next task. After each task she taps how it felt
 * (😅 hard / 🌿 ok / 🌟 easy / pass). Behind the scenes the engine writes a
 * placement level (0..2) into her Skill Ladder once all 3 tasks per skill
 * are answered, so the catch-up trajectory starts from real evidence.
 */

const SUBJECT_META: Record<string, { label: string; emoji: string; color: string }> = {
  math:    { label: "Math",          emoji: "🧮", color: "#fbbf24" },
  ela:     { label: "Reading & Writing", emoji: "📚", color: "#60a5fa" },
  science: { label: "Science",       emoji: "🔬", color: "#34d399" },
  ss:      { label: "Social Studies",emoji: "🌎", color: "#f472b6" },
};

type TaskRow = {
  taskId: number;
  taskOrder: number;
  gradeLevel: string;
  taskType: string;
  kidPrompt: string;
  choices: string[] | null;
  hint: string | null;
  skillId: number;
  skillCode: string;
  skillTitle: string;
  strand: string;
  subjectSlug: string;
  ladderOrder: number;
  response: { isCorrect: boolean | null; feltIt: string } | null;
};

export default function Placement() {
  const { companionAvatar, companionName } = useKiwi();
  const status = trpc.placement.status.useQuery(undefined, { refetchOnWindowFocus: false });
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [showCover, setShowCover] = useState(true);

  if (status.isLoading) {
    return <div className="container py-10 text-muted-foreground">Loading…</div>;
  }

  const overall = status.data?.percentOverall ?? 0;

  // Cover screen
  if (showCover && !activeSubject) {
    return (
      <div className="container py-6 max-w-2xl mx-auto space-y-4">
        <Card className="classroom-card p-6 space-y-4 text-center">
          <div className="text-6xl" aria-hidden>🌱</div>
          <h1 className="font-display text-3xl">Hi Reagan — let's find your level.</h1>
          <p className="text-base leading-relaxed text-neutral-300 max-w-lg mx-auto">
            This is <strong>not</strong> a test. There are <strong>no scores</strong>, no grades, no winning or losing.
            I'm just trying to learn what feels easy for you and what feels harder, so we can build the right next steps together.
          </p>
          <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-4 text-left max-w-lg mx-auto space-y-2 text-sm">
            <p>{companionAvatar} <strong>{companionName || "Kiwi"} promises:</strong></p>
            <ul className="list-disc pl-5 space-y-1 text-neutral-200">
              <li>You can stop anytime — your progress is saved.</li>
              <li>If something feels too hard, just tap "Skip" — that's good info too.</li>
              <li>I'll <em>never</em> say you got something wrong. I'll just help you with that one later.</li>
              <li>Pick the subject you feel like starting with — any order is fine.</li>
            </ul>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {Object.entries(SUBJECT_META).map(([slug, meta]) => {
              const sub = (status.data?.subjects || []).find((s) => s.subjectSlug === slug);
              const pct = sub?.percentDone ?? 0;
              return (
                <button
                  key={slug}
                  onClick={() => { setActiveSubject(slug); setShowCover(false); }}
                  className="px-4 py-3 rounded-xl border-2 font-semibold flex items-center gap-2 transition hover:scale-105"
                  style={{ borderColor: meta.color, background: `${meta.color}22`, color: "#f7f1e3" }}
                >
                  <span className="text-2xl" aria-hidden>{meta.emoji}</span>
                  <span className="flex flex-col items-start text-left">
                    <span>{meta.label}</span>
                    <span className="text-xs opacity-80">{pct}% done</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground pt-2">
            Overall: {overall}% · You can come back to this anytime from the Today page.
          </div>
        </Card>
      </div>
    );
  }

  if (activeSubject) {
    return (
      <PlacementSubject
        subjectSlug={activeSubject}
        onDone={() => { setActiveSubject(null); setShowCover(true); status.refetch(); }}
      />
    );
  }

  return null;
}

function PlacementSubject({ subjectSlug, onDone }: { subjectSlug: string; onDone: () => void }) {
  const meta = SUBJECT_META[subjectSlug] || { label: subjectSlug, emoji: "✨", color: "#94a3b8" };
  const tasksQ = trpc.placement.tasks.useQuery({ subjectSlug }, { refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const submit = trpc.placement.submit.useMutation({
    onSuccess: (res: any) => {
      utils.placement.tasks.invalidate({ subjectSlug });
      utils.placement.status.invalidate();
      utils.skillLadder.list.invalidate();
      utils.skillLadder.summary.invalidate();
      utils.skillLadder.nextUp.invalidate();
      if (res?.allDone) {
        toast.success("Got it! I figured out where to start with this skill — we'll build from here.", { icon: "🌱", duration: 4000 });
      }
    },
  });

  // First unanswered task in subject order
  const tasks: TaskRow[] = (tasksQ.data as any[]) || [];
  const next = useMemo(() => tasks.find((t) => !t.response), [tasks]);
  const totalDone = tasks.filter((t) => t.response).length;
  const total = tasks.length;
  const pct = total ? Math.round((totalDone / total) * 100) : 0;

  const [picked, setPicked] = useState<string>("");
  const [submittedKey, setSubmittedKey] = useState<number | null>(null);

  if (tasksQ.isLoading) return <div className="container py-10 text-muted-foreground">Loading…</div>;

  if (!next) {
    return (
      <div className="container py-10 max-w-xl mx-auto space-y-4">
        <Card className="classroom-card p-6 text-center space-y-3" style={{ borderTop: `4px solid ${meta.color}` }}>
          <div className="text-5xl" aria-hidden>{meta.emoji}</div>
          <h2 className="font-display text-2xl">Done with {meta.label}!</h2>
          <p className="text-sm text-neutral-300">
            I learned where to start with you on every {meta.label.toLowerCase()} skill. Your starting points are saved on
            <Link href="/coins" className="text-amber-400 underline ml-1">My Skills</Link>.
          </p>
          <Button onClick={onDone} className="bg-amber-400 text-neutral-900">Pick another subject</Button>
        </Card>
      </div>
    );
  }

  const justSubmitted = submittedKey === next.taskId;

  return (
    <div className="container py-6 max-w-2xl mx-auto space-y-4">
      {/* Top progress strip */}
      <div className="flex items-center gap-3">
        <button onClick={onDone} className="text-sm text-neutral-400 underline">← Subjects</button>
        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
        </div>
        <span className="text-xs text-neutral-400">{totalDone}/{total}</span>
      </div>

      <Card className="classroom-card p-6 space-y-4" style={{ borderTop: `4px solid ${meta.color}` }}>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {meta.emoji} {meta.label} · {next.strand}
        </div>
        <div className="font-display text-xl leading-tight">{next.skillTitle}</div>

        <div className="rounded-md bg-white/5 border border-white/10 p-4 text-base leading-relaxed">
          {next.kidPrompt}
        </div>

        {/* Choices */}
        {next.taskType === "pickOne" && Array.isArray(next.choices) && (
          <div className="grid sm:grid-cols-2 gap-2">
            {next.choices.map((c) => (
              <button
                key={c}
                disabled={justSubmitted || submit.isPending}
                onClick={() => setPicked(c)}
                className="text-left px-3 py-2 rounded-md border-2 transition"
                style={{
                  borderColor: picked === c ? meta.color : "#ffffff20",
                  background: picked === c ? `${meta.color}30` : "transparent",
                  color: "#f7f1e3",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {next.taskType === "shortAnswer" && (
          <input
            type="text"
            value={picked}
            disabled={justSubmitted || submit.isPending}
            onChange={(e) => setPicked(e.target.value)}
            placeholder="Type your answer here…"
            className="w-full px-3 py-2 rounded-md border-2 border-white/20 bg-white/5 text-neutral-100 focus:border-amber-400 focus:outline-none"
          />
        )}

        {/* Action row */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">How did that feel?</span>
          {(["easy", "ok", "hard"] as const).map((feel) => {
            const labels = { easy: "🌟 Easy", ok: "🌿 Okay", hard: "😅 Hard" }[feel];
            return (
              <Button key={feel} size="sm" variant="outline" className="bg-transparent text-xs h-8"
                disabled={!picked || submit.isPending}
                onClick={() => {
                  setSubmittedKey(next.taskId);
                  submit.mutate({ placementTaskId: next.taskId, kidAnswer: picked, feltIt: feel });
                  setTimeout(() => { setPicked(""); setSubmittedKey(null); }, 700);
                }}>
                {labels}
              </Button>
            );
          })}
          <Button size="sm" variant="ghost" className="text-xs h-8 ml-auto"
            disabled={submit.isPending}
            onClick={() => {
              setSubmittedKey(next.taskId);
              submit.mutate({ placementTaskId: next.taskId, kidAnswer: "", feltIt: "skip" });
              setTimeout(() => { setPicked(""); setSubmittedKey(null); }, 500);
            }}>
            Skip →
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground italic">
        Remember: there are no wrong answers here. Just keep going at your own pace.
      </p>
    </div>
  );
}
