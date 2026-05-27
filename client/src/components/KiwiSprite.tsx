import { useEffect, useState } from "react";

// Kiwi's core animation poses (stored on Manus storage CDN)
export const KIWI_POSES = {
  // Core poses (always loaded)
  idle:       "/manus-storage/kiwi_sm_idle_fdf35d4d.webp",
  flap:       "/manus-storage/kiwi_sm_flap_8c2badfd.webp",
  sleep:      "/manus-storage/kiwi_sm_sleep_22166bcf.webp",
  chirp:      "/manus-storage/kiwi_sm_chirp_f1bcdff8.webp",
  // Activity poses (lazy-loaded, shown during idle cycling)
  reading:    "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_reading-4N9G4iaro4iJkRrpwd5Qut.webp",
  cooking:    "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_cooking-NnECoEBrrARH42Pmk946Wh.webp",
  dancing:    "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_dancing-ZYhg5BYgYekMg7eLz7nAaU.webp",
  yoga:       "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_yoga-GDLLtS5eXV6eqj8qDR42ms.webp",
  painting:   "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_painting-an8gYheg2S8THCYDyPsCMH.webp",
  guitar:     "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_guitar-CsdFhXmjNP4A9wKMhdvSt2.webp",
  writing:    "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_writing-DboW9VxiCMp2nxJ8PEfC7D.webp",
  tv:         "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_tv-ee8dx6tKj8sLoJwdsXxScP.webp",
  eating:     "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_eating-BwNvBnMCWtrzn9KmBCDbeL.webp",
  exercise:   "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_exercise-AA4PdkGMgVBeHumew3Jyqp.webp",
  hammock:    "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_hammock-TwYsgMVtFrpfoJfsJVdQDz.webp",
  stargazing: "https://d2xsxph8kpxj0f.cloudfront.net/310519663309818529/mm3swGictQLHDWKPJCGiHp/kiwi_pose_stargazing-52ZydojzrkPXZSrrpzfenw.webp",
} as const;

export type KiwiPose = keyof typeof KIWI_POSES;

// Activity poses that can appear during idle cycling (excludes core poses)
export const KIWI_ACTIVITY_POSES: KiwiPose[] = [
  "reading", "cooking", "dancing", "yoga", "painting",
  "guitar", "writing", "tv", "eating", "exercise",
  "hammock", "stargazing",
];

// Speech bubble text for each activity pose
export const KIWI_ACTIVITY_BUBBLES: Partial<Record<KiwiPose, string>> = {
  reading:    "📖 Reading time!",
  cooking:    "👨‍🍳 Chef Kiwi!",
  dancing:    "🎵 Dance break!",
  yoga:       "🧘 Breathe in...",
  painting:   "🎨 Making art!",
  guitar:     "🎸 Strumming away~",
  writing:    "✏️ Taking notes!",
  tv:         "📺 Watching something good!",
  eating:     "🌱 Snack time!",
  exercise:   "💪 Let's move!",
  hammock:    "😴 Zzz... napping...",
  stargazing: "⭐ Counting stars!",
};

// Core poses that are always preloaded
const CORE_POSES: KiwiPose[] = ["idle", "flap", "sleep", "chirp"];

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
 * - Switches between 16 poses (4 core + 12 activity) with smooth crossfade
 * - Activity poses are lazy-loaded (only rendered once seen)
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
  // Track which activity poses have been seen (lazy-load them)
  const [seenPoses, setSeenPoses] = useState<Set<KiwiPose>>(new Set(CORE_POSES));

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // When a new activity pose is requested, add it to the seen set so it renders
  useEffect(() => {
    if (!seenPoses.has(pose)) {
      setSeenPoses((prev) => new Set(Array.from(prev).concat(pose)));
    }
  }, [pose, seenPoses]);

  const effectiveAnimate = animate && !reduced;

  // Determine which poses to render (core always + any seen activity poses)
  const posesToRender = (Object.keys(KIWI_POSES) as KiwiPose[]).filter(
    (p) => CORE_POSES.includes(p) || seenPoses.has(p)
  );

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
        {/* Rendered poses stacked; only the active pose is visible (crossfade via opacity) */}
        {posesToRender.map((p) => (
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
        {effectiveAnimate && pose !== "sleep" && pose !== "hammock" && (
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
