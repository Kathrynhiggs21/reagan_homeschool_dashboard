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
import { trpc } from "@/lib/trpc";

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
    title: "I'm Kiwi.",
    body:
      "I run on this dashboard. Eight quick screens. Skip ahead or stop whenever — this isn't a test.",
    kiwiLine:
      "I'm Kiwi. Eight quick screens. Skip ahead whenever.",
  },
  {
    emoji: "📋",
    title: "Today.",
    body:
      "Every day starts here. Blocks are what's planned — math, reading, science, whatever's on for the day. Tap one to open it.",
    kiwiLine:
      "Today is where every day starts. Tap a block to open it.",
  },
  {
    emoji: "🪙",
    title: "Coins.",
    body:
      "Finishing blocks earns coins. Extra practice earns more. Spend them in the Coin Shop on things Mom set up.",
    kiwiLine:
      "Coins come from finishing blocks and extra practice. Spend them in the Coin Shop.",
  },
  {
    emoji: "✨",
    title: "Practice for Coins.",
    body:
      "Extra spelling, math, or science outside school hours adds bonus coins. Optional. The Practice button on Today opens it.",
    kiwiLine:
      "Practice for Coins is optional extra outside school hours.",
  },
  {
    emoji: "🖨️",
    title: "Print today.",
    body:
      "Want a worksheet on paper instead of on screen? Tap Print today. Snap a photo when you're done to turn it in.",
    kiwiLine:
      "Print today gives you a paper worksheet. Photo of it when you're done.",
  },
  {
    emoji: "📱",
    title: "Apps & Tools.",
    body:
      "Khan, IXL, BrainPOP, Roblox — all in Apps & Tools. One tap opens the right account, already signed in.",
    kiwiLine:
      "Apps and Tools — Khan, IXL, BrainPOP, Roblox. One tap, signed in.",
  },
  {
    emoji: "🔖",
    title: "Mark a block tough.",
    body:
      "If something's too much, mark the block tough. Mom and your tutor see it and adjust tomorrow. No explanation needed.",
    kiwiLine:
      "Mark a block tough and Mom adjusts tomorrow. No explanation needed.",
  },
  {
    emoji: "💬",
    title: "Asking & requests.",
    body:
      "Tap me on any page to ask something or send a request — snack, supplies, schedule change. I stay quiet until you tap.",
    kiwiLine:
      "Tap me on any page to ask something or send a request.",
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
  // Push 2.13 (2026-05-17): mirror dismissal to learnerProfile.onboardingCompleted
  // so the tour stays dismissed cross-device, not just in this localStorage.
  const utils = trpc.useUtils();
  const profileUpdate = trpc.profile.update.useMutation({
    onSuccess: () => {
      try {
        utils.profile.get.invalidate();
      } catch {
        /* no-op */
      }
    },
  });
  const dismissForever = React.useCallback(() => {
    markTourSeen();
    try {
      profileUpdate.mutate({ onboardingCompleted: true });
    } catch {
      /* no-op */
    }
    onClose();
  }, [onClose, profileUpdate]);

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
        dismissForever();
      } else if (e.key === "ArrowRight") {
        setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
      } else if (e.key === "ArrowLeft") {
        setStepIdx((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissForever]);

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
        dismissForever();
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
              dismissForever();
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
                dismissForever();
              }}
            >
              Done
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
