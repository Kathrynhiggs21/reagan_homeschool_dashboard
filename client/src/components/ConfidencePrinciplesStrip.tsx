import { useState } from "react";
import { Card } from "@/components/ui/card";

/**
 * Compact kid-readable confidence principles. Mounts on Today, just below
 * the daily tip strip. Tap any chip to read the full sentence.
 */
const PRINCIPLES = [
  { emoji: "🛟", short: "Feel safe", full: "No timers, no red marks, no 'wrong'. We're just learning." },
  { emoji: "🧠", short: "Understand", full: "You can pick how to learn — story, picture, video, or practice." },
  { emoji: "📈", short: "Grow on purpose", full: "Each day a little ladder step. You see your level going up." },
  { emoji: "✨", short: "You ARE smart", full: "Kiwi notices what you figured out yourself — that's the proof." },
];

export default function ConfidencePrinciplesStrip() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <Card className="classroom-card p-3">
      <div className="flex flex-wrap gap-2">
        {PRINCIPLES.map((p, i) => (
          <button
            key={p.short}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${
              openIdx === i
                ? "bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-500/25 dark:text-amber-100"
                : "bg-background/30 border-white/15 hover:bg-amber-500/10"
            }`}
            aria-expanded={openIdx === i}
            aria-label={`${p.short}: ${p.full}`}
          >
            <span aria-hidden>{p.emoji}</span>
            <span className="font-display">{p.short}</span>
          </button>
        ))}
      </div>
      {openIdx !== null && (
        <div className="mt-2 px-2 text-sm text-neutral-700 dark:text-neutral-100">
          {PRINCIPLES[openIdx].full}
        </div>
      )}
    </Card>
  );
}
