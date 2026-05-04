/**
 * IntroTour — Kiwi-narrated walkthrough of the dashboard.
 *
 * Mom asked May 2026: a friendly intro from Kiwi to Reagan that explains
 * how everything in the site works, including how to talk to the AI.
 *
 * Behavior:
 *  - Auto-shows the first time on Today (gated by localStorage `kiwiTourSeen`).
 *  - Has a "Replay tour" button (rendered separately by Today.tsx).
 *  - Each step has a kid-friendly narration line; if cartoon voice is on,
 *    Kiwi reads it aloud via speakAs(). Otherwise it's just text (no robot).
 *  - Skip / Next / Done controls. Progress dots. Big tap targets.
 *  - Closes cleanly on Escape or backdrop click.
 *
 * Pure UI component — no tRPC calls. Safe to render on every page,
 * but Today.tsx is the natural mounting point because that's where Reagan
 * lands after login.
 */
import * as React from "react";
import { speakAs } from "@/lib/companionVoices";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "kiwiTourSeen";

interface TourStep {
  emoji: string;
  title: string;
  body: string;
  /** Kiwi's spoken line (only used when cartoon voice is enabled). */
  kiwiLine: string;
}

const STEPS: TourStep[] = [
  {
    emoji: "🐤",
    title: "Hi Reagan! I'm Kiwi.",
    body:
      "I'm your buddy on this dashboard. I'll show you how everything works in just 8 quick steps. You can stop any time.",
    kiwiLine:
      "Hi Reagan! I'm Kiwi. I'm your buddy on this dashboard. Let's take a quick tour together!",
  },
  {
    emoji: "📋",
    title: "Today is your home base.",
    body:
      "Every day starts here. You'll see your blocks for today — math, reading, science, all of it. Tap a block to see what's inside.",
    kiwiLine:
      "Today is your home base. You'll see all your blocks here. Tap any block to see what's inside.",
  },
  {
    emoji: "🪙",
    title: "Coins are how you earn fun stuff.",
    body:
      "Finish blocks, log a green mood, or do extra Practice — you earn Kiwi Coins. Spend them in the Coin Shop on rewards Mom set up.",
    kiwiLine:
      "Coins are how you earn fun stuff. Finish a block, do extra practice, or log a green mood, and you'll earn coins.",
  },
  {
    emoji: "✨",
    title: "Practice for Coins is for extra credit.",
    body:
      "Outside school hours, you can do extra spelling, math, or science to earn bonus coins. The Practice button on the homepage takes you there.",
    kiwiLine:
      "Want extra coins? Tap Practice for Coins! It's only open before school, after school, or on weekends, so it stays a treat.",
  },
  {
    emoji: "🖨️",
    title: "Print today does paper worksheets.",
    body:
      "If you'd rather do a worksheet on paper, tap Print today. Each worksheet has lines or boxes. When you finish, snap a photo and turn it in!",
    kiwiLine:
      "If you like working on paper, tap Print today. Then snap a picture when you're done to turn it in.",
  },
  {
    emoji: "📱",
    title: "Apps & Tools is your launcher.",
    body:
      "Khan Academy, IXL, BrainPOP, Roblox — they're all in Apps & Tools. One tap opens the right account.",
    kiwiLine:
      "Apps and Tools is where Khan, IXL, BrainPOP, and Roblox live. One tap and you're in.",
  },
  {
    emoji: "💛",
    title: "Tell me how you feel.",
    body:
      "If something feels hard or yucky, tap the heart on a block to log it. That helps Mom and your tutor make tomorrow gentler.",
    kiwiLine:
      "If something feels hard, tap the little heart on a block. That tells Mom what to soften tomorrow.",
  },
  {
    emoji: "💬",
    title: "Talk to me any time.",
    body:
      "Tap me (the green bird) on any page to ask a question. You can type it or use the Make-a-Request buttons for snacks, supplies, or schedule changes.",
    kiwiLine:
      "Tap me, the green bird, on any page to ask a question or make a request. I'm always here.",
  },
];

export function hasSeenTour(): boolean {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) === "1";
  } catch {
    return true; // assume seen if storage is locked
  }
}

export function markTourSeen() {
  try {
    window.localStorage?.setItem(STORAGE_KEY, "1");
  } catch {
    /* no-op */
  }
}

export function clearTourSeen() {
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

export function IntroTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [stepIdx, setStepIdx] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    setStepIdx(0);
  }, [open]);

  // Speak the current step's line when it changes (cartoon voice only;
  // speakAs() is a no-op when cartoon voice is off — no robot fallback).
  React.useEffect(() => {
    if (!open) return;
    const step = STEPS[stepIdx];
    if (step?.kiwiLine) {
      try {
        speakAs("kiwi", step.kiwiLine);
      } catch {
        /* no-op */
      }
    }
  }, [open, stepIdx]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        markTourSeen();
        onClose();
      } else if (e.key === "ArrowRight") {
        setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
      } else if (e.key === "ArrowLeft") {
        setStepIdx((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kiwi's intro tour"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      onClick={() => {
        markTourSeen();
        onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border-4 border-yellow-300 bg-amber-50 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-4xl" aria-hidden>
            {step.emoji}
          </span>
          <button
            type="button"
            aria-label="Skip tour"
            className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 hover:bg-amber-200"
            onClick={() => {
              markTourSeen();
              onClose();
            }}
          >
            Skip
          </button>
        </div>

        <h2 className="mb-2 font-['Fredoka'] text-2xl font-bold text-emerald-800">
          {step.title}
        </h2>
        <p className="mb-5 text-base leading-relaxed text-stone-800">
          {step.body}
        </p>

        <div className="mb-5 flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                i === stepIdx ? "bg-emerald-500" : "bg-stone-300"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(i - 1, 0))}
            className="bg-white"
          >
            ← Back
          </Button>
          <span className="text-sm text-stone-500">
            {stepIdx + 1} of {STEPS.length}
          </span>
          {isLast ? (
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                markTourSeen();
                onClose();
              }}
            >
              I'm ready! 🎉
            </Button>
          ) : (
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))}
            >
              Next →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default IntroTour;
