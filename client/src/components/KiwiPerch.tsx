import { useEffect, useState, useRef } from "react";
import KiwiSprite, { type KiwiPose } from "./KiwiSprite";
import { useKiwi } from "@/contexts/KiwiContext";

/**
 * KiwiPerch — the live animated Kiwi parakeet that lives in a corner of the screen.
 * Separate from the chat panel (KiwiCompanion). Think of her as the pet that's always there.
 *
 * Behaviors:
 * - Idle pose by default, breathing + blinking
 * - 2 min idle → sleep pose (zZz)
 * - 8 min idle → flies to a different corner (random), wakes up
 * - On any "completion" event (listen on window event 'kiwi:celebrate') → flap pose + tiny bounce + confetti ping
 * - On click → chirp pose briefly, opens the main chat panel
 * - Speech bubble with random friendly line every ~90s
 *
 * 4 preset perches: top-right, bottom-right (default), top-left, bottom-left.
 */

type Corner = "top-right" | "bottom-right" | "top-left" | "bottom-left";

const CORNER_STYLES: Record<Corner, React.CSSProperties> = {
  "top-right": { top: "5.5rem", right: "1rem" },
  "bottom-right": { bottom: "6.5rem", right: "1rem" },
  "top-left": { top: "5.5rem", left: "1rem" },
  "bottom-left": { bottom: "6.5rem", left: "1rem" },
};

const FRIENDLY_LINES = [
  "You've got this! 🌟",
  "I'm watching — good job!",
  "Deep breath, then try.",
  "Science time soon?",
  "Don't forget to smile 🌈",
  "I love your brain.",
  "Little steps count.",
  "You're doing better than you think.",
  "What's your favorite animal today?",
  "Sparkles in your eyes today ✨",
];

export default function KiwiPerch() {
  const { enabled, open, setOpen, adultPresent } = useKiwi();
  const [pose, setPose] = useState<KiwiPose>("idle");
  const [corner, setCorner] = useState<Corner>("bottom-right");
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [flying, setFlying] = useState(false);
  const lastInteractRef = useRef(Date.now());
  const bubbleTimeoutRef = useRef<number | null>(null);

  // Tick to manage idle states
  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      const idleMs = Date.now() - lastInteractRef.current;
      // 2 min idle → sleep (unless already sleeping or flying)
      if (idleMs > 2 * 60 * 1000 && pose !== "sleep" && !flying) {
        setPose("sleep");
      }
      // 8 min idle → fly to new corner, wake up
      if (idleMs > 8 * 60 * 1000 && !flying) {
        const corners: Corner[] = ["top-right", "bottom-right", "top-left", "bottom-left"];
        const next = corners[Math.floor(Math.random() * corners.length)];
        if (next !== corner) {
          setFlying(true);
          setPose("flap");
          window.setTimeout(() => {
            setCorner(next);
            setFlying(false);
            setPose("idle");
            lastInteractRef.current = Date.now();
          }, 1400);
        }
      }
    }, 10 * 1000);
    return () => window.clearInterval(interval);
  }, [enabled, pose, flying, corner]);

  // Random friendly line every 90s (if not sleeping/flying and not adult present)
  useEffect(() => {
    if (!enabled || adultPresent) return;
    const interval = window.setInterval(() => {
      if (pose === "sleep" || flying) return;
      const line = FRIENDLY_LINES[Math.floor(Math.random() * FRIENDLY_LINES.length)];
      setBubbleText(line);
      setPose("chirp");
      if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
      bubbleTimeoutRef.current = window.setTimeout(() => {
        setBubbleText(null);
        setPose("idle");
      }, 4500);
    }, 90 * 1000);
    return () => window.clearInterval(interval);
  }, [enabled, adultPresent, pose, flying]);

  // Listen for celebration events (e.g., when a block is completed)
  useEffect(() => {
    const onCelebrate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPose("flap");
      setBubbleText(detail?.message || "Yay! 🎉");
      lastInteractRef.current = Date.now();
      if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
      bubbleTimeoutRef.current = window.setTimeout(() => {
        setBubbleText(null);
        setPose("idle");
      }, 3000);
    };
    window.addEventListener("kiwi:celebrate", onCelebrate as EventListener);
    return () => window.removeEventListener("kiwi:celebrate", onCelebrate as EventListener);
  }, []);

  if (!enabled) return null;

  const isLeft = corner.includes("left");

  return (
    <div
      className="fixed z-30 no-print pointer-events-none"
      style={{
        ...CORNER_STYLES[corner],
        transition: "all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <div className="relative flex items-end pointer-events-auto" style={{ flexDirection: isLeft ? "row-reverse" : "row" }}>
        {/* Speech bubble */}
        {bubbleText && (
          <div
            className={`kiwi-bubble ${isLeft ? "ml-2" : "mr-2"} mb-14 bg-white text-slate-800 border-2 border-amber-200 rounded-2xl px-3 py-2 text-xs font-medium shadow-lg max-w-[180px] animate-in fade-in-0 slide-in-from-bottom-2`}
            style={{
              fontFamily: "'Patrick Hand', 'Comic Sans MS', cursive",
              fontSize: "13px",
              lineHeight: 1.2,
            }}
          >
            {bubbleText}
            <div
              className="absolute w-3 h-3 bg-white border-amber-200 transform rotate-45"
              style={{
                bottom: -6,
                [isLeft ? "left" : "right"]: 18,
                borderRight: isLeft ? "2px solid" : undefined,
                borderBottom: "2px solid",
                borderColor: "rgb(253 230 138)",
              }}
            />
          </div>
        )}

        {/* Kiwi herself */}
        <div
          className="pointer-events-auto"
          onClick={() => {
            lastInteractRef.current = Date.now();
            setPose("chirp");
            setBubbleText("Hi! 💛");
            if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
            bubbleTimeoutRef.current = window.setTimeout(() => {
              setBubbleText(null);
              setPose("idle");
              setOpen(!open);
            }, 700);
          }}
          style={{
            cursor: "pointer",
            transform: flying ? "translateY(-30px) rotate(-8deg)" : undefined,
            transition: "transform 0.8s ease-in-out",
          }}
        >
          <KiwiSprite pose={pose} size={96} animate ariaLabel="Kiwi the parakeet — click to chat" />
          {/* Wooden perch line under her */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
            style={{
              width: 70,
              height: 4,
              background: "linear-gradient(180deg, #a07a4a 0%, #6b4e2a 100%)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
              zIndex: -1,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Helper: fire a celebration event anywhere in the app
export function celebrateKiwi(message?: string) {
  window.dispatchEvent(new CustomEvent("kiwi:celebrate", { detail: { message } }));
}
