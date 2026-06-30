import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useKiwi } from "@/contexts/KiwiContext";

const STORAGE_KEY = "kiwi-intro-dismissed-v1";
const PLAYED_KEY = "kiwi-intro-played-v1";

// 5-line timed script. Plays automatically the very first time, then on demand.
const SCRIPT = [
  { ms: 0,    text: "I'm Kiwi." },
  { ms: 1800, text: "No tests, no timers, no wrong answers here." },
  { ms: 3600, text: "If something's hard, mark it tough. Mom adjusts tomorrow." },
  { ms: 5400, text: "I stay quiet until you tap me." },
  { ms: 7800, text: "That's it. Carry on." },
] as const;

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
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Auto-play once on first ever view.
  useEffect(() => {
    if (dismissed) return;
    if (localStorage.getItem(PLAYED_KEY) === "1") return;
    localStorage.setItem(PLAYED_KEY, "1");
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed]);

  function play() {
    // Clear any in-flight timers, then schedule the script.
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPlaying(true);
    setStep(-1);
    SCRIPT.forEach((line, i) => {
      timersRef.current.push(window.setTimeout(() => setStep(i), line.ms));
    });
    // Stop after the last line + 2s breathing room.
    const total = SCRIPT[SCRIPT.length - 1].ms + 2400;
    timersRef.current.push(window.setTimeout(() => setPlaying(false), total));
  }

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

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
          I'm {companionName || "Kiwi"}.
        </div>
        {playing ? (
          <div className="min-h-[68px] mt-1">
            {SCRIPT.map((line, i) => (
              <p
                key={i}
                className={`text-[15px] leading-snug font-medium text-amber-950 transition-all duration-500 ${i === step ? "opacity-100 translate-y-0" : i < step ? "opacity-50 -translate-y-1" : "opacity-0 translate-y-2 absolute"}`}
                aria-hidden={i !== step}
              >
                {line.text}
              </p>
            ))}
          </div>
        ) : (
          <>
            <p className="text-[14px] leading-snug text-amber-950 mt-1">
              No tests, no timers, no wrong answers here. If something's too much, mark the block tough — Mom adjusts tomorrow. I stay quiet until you tap me.
            </p>
            <div className="mt-2 flex gap-2 flex-wrap text-[12px] font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 border border-amber-400">No tests</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 border border-amber-400">No timers</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 border border-amber-400">You pick how to learn</span>
            </div>
            {/* Theme switching lives in the sidebar (SidebarThemePicker); the
                duplicate strip that used to sit here was removed 2026-06-30 so
                the two pickers no longer stack/overlap on narrow screens. */}
          </>
        )}
        <div className="mt-3">
          <button
            type="button"
            onClick={play}
            disabled={playing}
            className="text-[12px] font-semibold underline text-amber-900 disabled:opacity-50"
          >
            {playing ? "…playing" : "▶ Play again"}
          </button>
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
        Got it
      </Button>
    </div>
  );
}
