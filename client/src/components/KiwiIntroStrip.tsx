import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useKiwi } from "@/contexts/KiwiContext";

const STORAGE_KEY = "kiwi-intro-dismissed-v1";

/**
 * KiwiIntroStrip
 *
 * Tiny calm card on Today that introduces Kiwi to Reagan in plain language.
 * Dismissible — once she taps "Got it!" it stays gone (per browser).
 * She can also re-open it any time from About Me / Settings.
 */
export default function KiwiIntroStrip() {
  const { companionName, companionAvatar, photoUrl } = useKiwi();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div className="rounded-2xl border-2 border-amber-300/60 bg-[#fff8e6] dark:bg-amber-100/95 text-amber-950 p-4 flex items-start gap-3 shadow-md">
      <div className="text-4xl shrink-0" aria-hidden>
        {photoUrl ? (
          <img src={photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-amber-500" />
        ) : (
          companionAvatar || "🪶"
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-lg text-amber-900">
          Hi! I'm {companionName || "Kiwi"}.
        </div>
        <p className="text-[14px] leading-snug text-amber-950 mt-1">
          I'm here to help you <strong>feel smart</strong> and figure stuff out. I never test you, never time you,
          and never get the answer "wrong." If something feels too hard, just tell me — we'll try a different way
          together. You're already doing great.
        </p>
        <div className="mt-2 flex gap-2 flex-wrap text-[12px] font-semibold">
          <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 border border-amber-400">No tests</span>
          <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 border border-amber-400">No timers</span>
          <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 border border-amber-400">You pick how to learn it</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="bg-amber-200/80 hover:bg-amber-300 border-amber-400 text-amber-900 shrink-0"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setDismissed(true);
        }}
      >
        Got it!
      </Button>
    </div>
  );
}
