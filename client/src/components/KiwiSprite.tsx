import { useEffect, useState } from "react";

// Kiwi's 4 core animation poses (stored on Manus storage CDN)
export const KIWI_POSES = {
  idle: "/manus-storage/kiwi_sm_idle_fdf35d4d.webp",
  flap: "/manus-storage/kiwi_sm_flap_8c2badfd.webp",
  sleep: "/manus-storage/kiwi_sm_sleep_22166bcf.webp",
  chirp: "/manus-storage/kiwi_sm_chirp_f1bcdff8.webp",
} as const;

export type KiwiPose = keyof typeof KIWI_POSES;

interface KiwiSpriteProps {
  pose?: KiwiPose;
  size?: number; // pixel size
  animate?: boolean; // enable idle breathing + blink + tail-twitch
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * KiwiSprite — the animated parakeet companion.
 * - Always breathes (subtle scale Y)
 * - Blinks every ~4s (opacity-masked overlay that dips briefly)
 * - Tail-twitch every ~12s (tiny rotate)
 * - Switches between 4 poses (idle / flap / sleep / chirp) with smooth crossfade
 * - Respects prefers-reduced-motion (falls back to static)
 */
export default function KiwiSprite({
  pose = "idle",
  size = 96,
  animate = true,
  className = "",
  onClick,
  ariaLabel = "Kiwi the parakeet",
}: KiwiSpriteProps) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const effectiveAnimate = animate && !reduced;

  return (
    <div
      className={`kiwi-sprite-wrap inline-block relative select-none ${className} ${onClick ? "cursor-pointer" : ""}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      role={onClick ? "button" : "img"}
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : -1}
    >
      {/* Breathing + tail-twitch wrapper */}
      <div
        className={effectiveAnimate ? "kiwi-breathe" : ""}
        style={{ width: "100%", height: "100%", position: "relative" }}
      >
        {/* All 4 pose images stacked; only the active pose is visible (crossfade via opacity) */}
        {(Object.keys(KIWI_POSES) as KiwiPose[]).map((p) => (
          <img
            key={p}
            src={KIWI_POSES[p]}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-500"
            style={{
              opacity: p === pose ? 1 : 0,
              pointerEvents: "none",
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.25))",
            }}
          />
        ))}
        {/* Blink overlay — a translucent band that sweeps across eyes occasionally */}
        {effectiveAnimate && pose !== "sleep" && (
          <div className="kiwi-blink-overlay absolute inset-0 pointer-events-none" />
        )}
      </div>

      <style>{`
        @keyframes kiwi-breathe {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.03, 0.98) translateY(1px); }
        }
        @keyframes kiwi-blink {
          0%, 92%, 100% { opacity: 0; }
          94%, 98% { opacity: 0.35; }
        }
        .kiwi-breathe { animation: kiwi-breathe 3.2s ease-in-out infinite; transform-origin: center bottom; }
        .kiwi-blink-overlay {
          background: linear-gradient(to bottom, transparent 0%, transparent 28%, rgba(255,235,160,0.85) 30%, rgba(255,235,160,0.85) 40%, transparent 42%);
          animation: kiwi-blink 4.8s ease-in-out infinite;
          mix-blend-mode: multiply;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
