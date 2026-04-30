import { useMemo } from "react";

/**
 * MascotGreeting
 * --------------
 * A small rotating mascot illustration that sits next to the
 * "Good Morning, Reagan!" greeting. The mascot changes with the
 * day of the year so it feels fresh but still deterministic, and
 * rotates through Reagan's favorite animals + weather vibes.
 *
 * Pure CSS/emoji — no network, no sprite sheet.
 */

const MASCOTS: Array<{ emoji: string; label: string; hue: string }> = [
  { emoji: "🦜", label: "Kiwi the parakeet", hue: "#7fe3c4" },
  { emoji: "🦎", label: "Precious the dragon", hue: "#f7a65b" },
  { emoji: "🐦", label: "Backyard birdie", hue: "#9ecbff" },
  { emoji: "🦉", label: "Wise little owl", hue: "#c5a3ff" },
  { emoji: "🐢", label: "A cozy turtle", hue: "#9dd39a" },
  { emoji: "🐿️", label: "Chatty squirrel", hue: "#f2b28d" },
  { emoji: "🦋", label: "Garden butterfly", hue: "#ffa2c6" },
  { emoji: "🌞", label: "A little sunshine", hue: "#ffd97a" },
  { emoji: "🌱", label: "A new sprout", hue: "#9dd39a" },
  { emoji: "🦦", label: "Otter pal", hue: "#b8d3ff" },
];

function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export default function MascotGreeting() {
  const mascot = useMemo(() => {
    const idx = dayOfYear() % MASCOTS.length;
    return MASCOTS[idx]!;
  }, []);

  return (
    <div
      className="relative hidden sm:flex flex-col items-center justify-center select-none shrink-0"
      aria-label={`Today's mascot: ${mascot.label}`}
      title={mascot.label}
      style={{
        width: 92,
        height: 92,
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${mascot.hue}33, transparent 70%)`,
          filter: "blur(2px)",
        }}
      />
      <div
        className="relative text-5xl md:text-6xl"
        style={{
          textShadow: "0 4px 8px rgba(0,0,0,0.35)",
          animation: "mascot-float 3.6s ease-in-out infinite",
        }}
      >
        {mascot.emoji}
      </div>
      <style>{`
        @keyframes mascot-float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-6px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
