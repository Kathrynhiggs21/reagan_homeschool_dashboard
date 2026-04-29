import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { useKiwi } from "@/contexts/KiwiContext";
import { toast } from "sonner";

type Felt = "easy" | "ok" | "hard" | "skip";
type What = "story" | "visual" | "handsOn" | "watch" | "practice" | "kiwiTalk" | "tutor" | "movement" | "none";
type Time = "tooShort" | "justRight" | "tooLong";

const FELT: Array<{ id: Felt; emoji: string; label: string; color: string }> = [
  { id: "easy",  emoji: "🌟", label: "Easy",     color: "#22c55e" },
  { id: "ok",    emoji: "🌿", label: "Ok",       color: "#3b82f6" },
  { id: "hard",  emoji: "😅", label: "Hard",     color: "#f97316" },
  { id: "skip",  emoji: "⏭", label: "Skip",     color: "#6b7280" },
];
const WHAT: Array<{ id: What; emoji: string; label: string }> = [
  { id: "story",     emoji: "📖", label: "Story" },
  { id: "visual",    emoji: "🎨", label: "Picture" },
  { id: "handsOn",   emoji: "🛠", label: "Hands-on" },
  { id: "watch",     emoji: "📺", label: "Video" },
  { id: "practice",  emoji: "✏", label: "Practice" },
  { id: "kiwiTalk",  emoji: "🦜", label: "Kiwi talk" },
  { id: "tutor",     emoji: "👩‍🏫", label: "Tutor" },
  { id: "movement",  emoji: "🏃", label: "Move it" },
  { id: "none",      emoji: "🤷", label: "Not sure" },
];
const TIME: Array<{ id: Time; emoji: string; label: string }> = [
  { id: "tooShort",  emoji: "⏱", label: "Too short" },
  { id: "justRight", emoji: "✅", label: "Just right" },
  { id: "tooLong",   emoji: "🐢", label: "Too long" },
];

/**
 * FeedbackChips — Reagan-friendly chip strip after a Skill Builder block.
 * Optional: she can tap zero chips and dismiss. Each chip writes immediately.
 */
export default function FeedbackChips({ skillLadderId, onDone }: { skillLadderId?: number; onDone?: () => void }) {
  const { companionAvatar } = useKiwi();
  const utils = trpc.useUtils();
  const record = trpc.feedback.record.useMutation({
    onSuccess: () => {
      utils.feedback.recent.invalidate();
      utils.feedback.whatHelped.invalidate();
      utils.games.moodWindow.invalidate();
    },
  });
  const [felt, setFelt] = useState<Felt | null>(null);
  const [what, setWhat] = useState<What | null>(null);
  const [time, setTime] = useState<Time | null>(null);
  const [wantBreak, setWantBreak] = useState(false);
  const [doneFlash, setDoneFlash] = useState(false);

  function save(extra: Partial<Parameters<typeof record.mutate>[0]> = {}) {
    record.mutate({
      skillLadderId: skillLadderId ?? null,
      feltIt: felt ?? undefined,
      whatHelped: what ?? undefined,
      timeFelt: time ?? undefined,
      wantedBreak: wantBreak,
      ...extra,
    });
  }

  function finish() {
    save();
    setDoneFlash(true);
    toast.success(`${companionAvatar} Got it — thanks for telling me.`, { icon: "💛" });
    setTimeout(() => onDone?.(), 600);
  }

  return (
    <Card className="overflow-hidden border-l-4 border-l-pink-400 bg-pink-50">
      <div className="p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="font-display text-base text-pink-900">Quick — how'd that feel?</div>
          <button onClick={finish} className="text-xs underline text-pink-700">Skip</button>
        </div>

        {/* Felt */}
        <div>
          <div className="text-[11px] uppercase tracking-wide text-pink-700 mb-1">How it felt</div>
          <div className="flex flex-wrap gap-2">
            {FELT.map((f) => (
              <button key={f.id}
                onClick={() => { setFelt(f.id); save({ feltIt: f.id }); }}
                className="rounded-full border-2 px-3 py-1 text-sm font-semibold flex items-center gap-1 transition"
                style={{
                  background: felt === f.id ? f.color : "white",
                  color: felt === f.id ? "white" : f.color,
                  borderColor: f.color,
                }}>
                <span>{f.emoji}</span><span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* What helped */}
        <div>
          <div className="text-[11px] uppercase tracking-wide text-pink-700 mb-1">What helped most</div>
          <div className="flex flex-wrap gap-2">
            {WHAT.map((w) => (
              <button key={w.id}
                onClick={() => { setWhat(w.id); save({ whatHelped: w.id }); }}
                className="rounded-full border px-3 py-1 text-sm flex items-center gap-1 transition"
                style={{
                  background: what === w.id ? "#ec4899" : "white",
                  color: what === w.id ? "white" : "#831843",
                  borderColor: "#f9a8d4",
                }}>
                <span>{w.emoji}</span><span>{w.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time pacing + want break */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-pink-700 mb-1">Time felt</div>
            <div className="flex flex-wrap gap-2">
              {TIME.map((t) => (
                <button key={t.id}
                  onClick={() => { setTime(t.id); save({ timeFelt: t.id }); }}
                  className="rounded-full border px-3 py-1 text-sm flex items-center gap-1 transition"
                  style={{
                    background: time === t.id ? "#ec4899" : "white",
                    color: time === t.id ? "white" : "#831843",
                    borderColor: "#f9a8d4",
                  }}>
                  <span>{t.emoji}</span><span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-pink-900 cursor-pointer">
            <input type="checkbox" checked={wantBreak}
              onChange={(e) => { setWantBreak(e.target.checked); save({ wantedBreak: e.target.checked }); }} />
            <span>Want a break?</span>
          </label>
        </div>

        <div className="flex justify-end pt-1">
          <button onClick={finish}
            className="rounded-full bg-pink-500 text-white text-sm px-4 py-1.5 font-semibold hover:bg-pink-600">
            {doneFlash ? "Saved 💛" : "Done"}
          </button>
        </div>
      </div>
    </Card>
  );
}
