import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

/**
 * /placement — kid-friendly diagnostic placement flow for Reagan.
 *
 * Design rules (from schema comment + InviteCard tone):
 *   - Reagan sees ONLY encouragement. Never "right" / "wrong" / "score".
 *   - She picks a subject, walks through that subject's tasks one-at-a-time,
 *     each task ends with a "how did that feel?" easy / ok / hard / skip pick.
 *   - Adults can see the real grade-level result on a separate dashboard
 *     (not built here — placementResults rows back it).
 *
 * Wires:
 *   - placement.status (per-subject progress)
 *   - placement.tasks({ subjectSlug }) (the question list, pre-sorted)
 *   - placement.submit (records answer + feltIt, server auto-grades silently)
 */

type FeltIt = "easy" | "ok" | "hard" | "skip";

const SUBJECT_LABEL: Record<string, { name: string; emoji: string }> = {
  math: { name: "Math", emoji: "🔢" },
  ela: { name: "Reading & Writing", emoji: "📖" },
  science: { name: "Science", emoji: "🔬" },
  ss: { name: "Social Studies", emoji: "🗺️" },
};

const ENCOURAGEMENTS = [
  "Nice — onto the next one.",
  "Good thinking. Here's another.",
  "Keep going, you're doing great.",
  "Awesome. Try this one.",
  "Cool — next!",
  "You're rolling. Here you go.",
];

export default function Placement() {
  const [subject, setSubject] = useState<string | null>(null);

  const status = trpc.placement.status.useQuery(undefined, { refetchOnWindowFocus: false });
  const utils = trpc.useUtils();

  if (!subject) {
    return <SubjectPicker status={status.data as StatusShape | undefined} onPick={setSubject} />;
  }

  return (
    <SubjectFlow
      subjectSlug={subject}
      onBack={() => {
        setSubject(null);
        utils.placement.status.invalidate();
      }}
    />
  );
}

type SubjectStatus = {
  subjectSlug: string;
  skillsTotal: number;
  skillsPlaced: number;
  tasksTotal: number;
  tasksDone: number;
  percentDone: number;
};
type StatusShape = {
  subjects: SubjectStatus[];
  percentOverall: number;
  totalDone: number;
  totalTasks: number;
};

function SubjectPicker({
  status,
  onPick,
}: {
  status: StatusShape | undefined;
  onPick: (slug: string) => void;
}) {
  return (
    <div className="container py-6 max-w-3xl space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-2xl">Skill Check-up</h1>
        <p className="text-sm text-neutral-300">
          Pick a subject. You'll get a few short questions — no grades, no
          right-or-wrong. Just tell Kiwi how each one feels.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {(status?.subjects ?? []).map((s: SubjectStatus) => {
          const label = SUBJECT_LABEL[s.subjectSlug] ?? { name: s.subjectSlug, emoji: "✏️" };
          const isDone = s.percentDone >= 100;
          return (
            <Card
              key={s.subjectSlug}
              className="classroom-card p-4 cursor-pointer hover:scale-[1.01] transition"
              onClick={() => onPick(s.subjectSlug)}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>{label.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-base">{label.name}</div>
                  <div className="text-xs text-neutral-400">
                    {isDone
                      ? "All done — good job"
                      : s.percentDone === 0
                        ? "Haven't started yet"
                        : `${s.percentDone}% explored — pick up where you left off`}
                  </div>
                </div>
                <span className="text-neutral-500" aria-hidden>→</span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="pt-4">
        <Link href="/today" className="text-sm text-neutral-400 underline">
          ← Back to Today
        </Link>
      </div>
    </div>
  );
}

function SubjectFlow({ subjectSlug, onBack }: { subjectSlug: string; onBack: () => void }) {
  const tasksQ = trpc.placement.tasks.useQuery({ subjectSlug }, { refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const submit = trpc.placement.submit.useMutation({
    onSettled: () => {
      utils.placement.tasks.invalidate({ subjectSlug });
      utils.placement.status.invalidate();
    },
  });

  const tasks = tasksQ.data ?? [];
  const remaining = useMemo(() => tasks.filter((t: any) => !t.response), [tasks]);
  const current = remaining[0];

  const [draftAnswer, setDraftAnswer] = useState<string>("");
  const [encouragementIdx, setEncouragementIdx] = useState(0);

  const label = SUBJECT_LABEL[subjectSlug] ?? { name: subjectSlug, emoji: "✏️" };

  if (tasksQ.isLoading) {
    return (
      <div className="container py-6 max-w-3xl">
        <div className="animate-pulse text-sm text-neutral-400">Loading…</div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="container py-6 max-w-3xl space-y-4 text-center">
        <div className="text-5xl">🌟</div>
        <h1 className="font-display text-2xl">All done with {label.name}!</h1>
        <p className="text-sm text-neutral-300">
          You explored every question Kiwi had for this one. Pick another
          subject when you feel like it.
        </p>
        <Button onClick={onBack} className="bg-[#a78bfa] text-black hover:bg-[#9f7df3]">
          ← Pick another subject
        </Button>
      </div>
    );
  }

  const choices: string[] = Array.isArray((current as any).choices)
    ? ((current as any).choices as any[]).map(String)
    : (() => {
        try {
          const parsed = JSON.parse((current as any).choices ?? "null");
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          return [];
        }
      })();

  const totalForSubject = tasks.length;
  const doneForSubject = totalForSubject - remaining.length;

  const handleSubmit = (feltIt: FeltIt, answerOverride?: string) => {
    if (submit.isPending) return;
    const kidAnswer = answerOverride ?? draftAnswer;
    submit.mutate(
      {
        placementTaskId: (current as any).taskId,
        kidAnswer: kidAnswer || undefined,
        feltIt,
      },
      {
        onSuccess: () => {
          setDraftAnswer("");
          setEncouragementIdx((i) => (i + 1) % ENCOURAGEMENTS.length);
        },
      },
    );
  };

  return (
    <div className="container py-6 max-w-3xl space-y-5">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <button onClick={onBack} className="underline">← Subjects</button>
        <span>{doneForSubject} of {totalForSubject} • {label.emoji} {label.name}</span>
      </div>

      <Card className="classroom-card p-5 space-y-4">
        <div className="text-xs uppercase tracking-wider text-neutral-400">
          {(current as any).skillTitle}
        </div>
        <div className="font-display text-lg leading-snug">
          {(current as any).kidPrompt}
        </div>

        {(current as any).hint && (
          <div className="text-xs text-neutral-400 italic">Hint: {(current as any).hint}</div>
        )}

        {/* Answer area */}
        {(current as any).taskType === "pickOne" && choices.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {choices.map((c) => (
              <Button
                key={c}
                variant="outline"
                disabled={submit.isPending}
                onClick={() => setDraftAnswer(c)}
                className={`justify-start bg-neutral-900/40 ${draftAnswer === c ? "ring-2 ring-[#a78bfa]" : ""}`}
              >
                {c}
              </Button>
            ))}
          </div>
        )}

        {(current as any).taskType === "trueFalse" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={submit.isPending}
              onClick={() => setDraftAnswer("true")}
              className={`bg-neutral-900/40 ${draftAnswer === "true" ? "ring-2 ring-[#a78bfa]" : ""}`}
            >True</Button>
            <Button
              variant="outline"
              disabled={submit.isPending}
              onClick={() => setDraftAnswer("false")}
              className={`bg-neutral-900/40 ${draftAnswer === "false" ? "ring-2 ring-[#a78bfa]" : ""}`}
            >False</Button>
          </div>
        )}

        {((current as any).taskType === "shortAnswer" || (current as any).taskType === "showMeHow") && (
          <textarea
            disabled={submit.isPending}
            value={draftAnswer}
            onChange={(e) => setDraftAnswer(e.target.value)}
            placeholder={(current as any).taskType === "showMeHow" ? "Tell Kiwi how you'd think about it…" : "Type your answer…"}
            className="w-full min-h-[80px] rounded-md bg-neutral-900/40 border border-neutral-700 p-2 text-sm"
          />
        )}

        {/* feltIt + skip */}
        <div className="space-y-2 pt-2">
          <div className="text-xs text-neutral-400">How did that feel?</div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={submit.isPending || !draftAnswer}
              onClick={() => handleSubmit("easy")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >Easy 🌱</Button>
            <Button
              disabled={submit.isPending || !draftAnswer}
              onClick={() => handleSubmit("ok")}
              className="bg-sky-600 hover:bg-sky-500 text-white"
            >Just OK 🌿</Button>
            <Button
              disabled={submit.isPending || !draftAnswer}
              onClick={() => handleSubmit("hard")}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >Tricky 🌶️</Button>
            <Button
              variant="outline"
              disabled={submit.isPending}
              onClick={() => handleSubmit("skip", "")}
              className="bg-neutral-900/40"
            >Skip ⏭</Button>
          </div>
        </div>

        {submit.isSuccess && !submit.isPending && (
          <div className="text-xs text-emerald-400 pt-1">{ENCOURAGEMENTS[encouragementIdx]}</div>
        )}
      </Card>
    </div>
  );
}
