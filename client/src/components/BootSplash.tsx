import { useEffect, useMemo, useState } from "react";
import KiwiSprite from "./KiwiSprite";
import { trpc } from "@/lib/trpc";

/**
 * BootSplash
 * ----------
 * A branded, cute, school-themed welcome shown on the FIRST app mount of a
 * session. Katy's ask (2026-06-19): the centered Kiwi-with-hat that appears
 * while the app loads should be joined by the title "Reagan's Homeschool"
 * animating into the screen with the bird — something educational and cute.
 *
 * Visual:
 *   - Centered Kiwi sprite wearing the graduation cap (costume="labcoat" gives
 *     the glasses; we add a 🎓 cap glyph + a floating ✏️ and 📖 for the
 *     "school" feel). The bird hops/flaps in from the left.
 *   - Title "Reagan's Homeschool" slides + fades in word-by-word beside her,
 *     with a friendly sub-line.
 *   - Little floating school doodles (✏️ 📖 ➗ 🔤 ⭐) drift up around the lockup.
 *
 * Behaviour:
 *   - Plays once per browser session (sessionStorage flag).
 *   - Auto-dismisses after the entrance finishes, then fades out.
 *   - Respects prefers-reduced-motion (static, quick dismiss).
 *   - Tap / any key dismisses early.
 */

const SESSION_KEY = "bootSplashSeen";
const WORD_COLORS = ["#fff4d6", "#bdf0d6"]; // chalk cream / chalk mint

/** Turn a name into its possessive form: "Reagan" -> "Reagan's", "Chris" -> "Chris'". */
function possessive(name: string): string {
  const n = name.trim();
  if (!n) return "";
  return /s$/i.test(n) ? `${n}’` : `${n}’s`;
}

// Little floating school doodles around the lockup.
const DOODLES = [
  { glyph: "✏️", top: 14, left: 18, delay: 0.2, dur: 5.2, size: 30 },
  { glyph: "📖", top: 72, left: 12, delay: 1.1, dur: 6.0, size: 34 },
  { glyph: "➗", top: 24, left: 82, delay: 0.6, dur: 5.6, size: 28 },
  { glyph: "🔤", top: 80, left: 80, delay: 1.6, dur: 6.4, size: 30 },
  { glyph: "⭐", top: 8, left: 50, delay: 0.9, dur: 5.0, size: 24 },
  { glyph: "🍎", top: 86, left: 46, delay: 0.3, dur: 5.8, size: 28 },
];

export default function BootSplash() {
  const [show, setShow] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(SESSION_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [leaving, setLeaving] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Pull the student's name from app settings (public profile query). While it
  // loads we fall back to "Reagan" so the splash never flashes a blank title.
  const profile = trpc.profile.get.useQuery(undefined, { enabled: show });
  const titleWords = useMemo(() => {
    const full = (profile.data?.studentName || "Reagan").trim();
    const first = full.split(/\s+/)[0] || "Reagan";
    return [possessive(first), "Homeschool"];
  }, [profile.data?.studentName]);

  useEffect(() => {
    if (!show) return;
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(mq.matches);
    } catch {
      /* ignore */
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    const holdMs = reduced ? 900 : 2600; // a touch longer so the doodles read
    const fadeMs = 440;
    const t1 = window.setTimeout(() => setLeaving(true), holdMs);
    const t2 = window.setTimeout(() => setShow(false), holdMs + fadeMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [show, reduced]);

  useEffect(() => {
    if (!show) return;
    const onKey = () => {
      setLeaving(true);
      window.setTimeout(() => setShow(false), 440);
    };
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  if (!show) return null;

  const dismissNow = () => {
    setLeaving(true);
    window.setTimeout(() => setShow(false), 440);
  };

  return (
    <div
      role="dialog"
      aria-label="Reagan's Homeschool — loading"
      onClick={dismissNow}
      className="boot-splash fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden cursor-pointer"
      style={{
        opacity: leaving ? 0 : 1,
        transition: "opacity 440ms ease",
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06), transparent 55%)," +
          "radial-gradient(ellipse at 80% 90%, rgba(255,255,255,0.04), transparent 60%)," +
          "linear-gradient(160deg, #1c2b27 0%, #232f2b 45%, #141d1a 100%)",
      }}
    >
      {/* Floating school doodles */}
      {!reduced &&
        DOODLES.map((d, i) => (
          <span
            key={i}
            aria-hidden
            className="boot-doodle absolute select-none"
            style={{
              top: `${d.top}%`,
              left: `${d.left}%`,
              fontSize: d.size,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.dur}s`,
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))",
            }}
          >
            {d.glyph}
          </span>
        ))}

      {/* Soft warm halo behind the lockup */}
      <div
        aria-hidden
        className="absolute"
        style={{
          width: 540,
          height: 540,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 45%, rgba(127,227,196,0.20), transparent 68%)",
          filter: "blur(8px)",
        }}
      />

      <div className="relative flex items-center gap-5 md:gap-7 px-6">
        {/* Kiwi the scholar — glasses (labcoat costume) + a graduation cap glyph,
            hopping/flapping in from the left. */}
        <div
          className={reduced ? "relative" : "boot-bird relative"}
          style={{ filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.45))" }}
        >
          <KiwiSprite
            pose="flap"
            size={140}
            animate={!reduced}
            costume="labcoat"
            ariaLabel="Kiwi, ready for school"
          />
          {/* Graduation cap sits on top of Kiwi's head */}
          <span
            aria-hidden
            className={reduced ? "absolute" : "boot-cap absolute"}
            style={{
              top: "-6%",
              left: "30%",
              fontSize: 52,
              lineHeight: 1,
              filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
            }}
          >
            🎓
          </span>
        </div>

        {/* Title — "<Name>'s Homeschool" sliding in word-by-word */}
        <div className="flex flex-col">
          <h1
            className="font-display leading-tight m-0 flex flex-col"
            style={{ letterSpacing: "-0.01em" }}
          >
            {titleWords.map((w, i) => (
              <span
                key={w}
                className={reduced ? "boot-word-static" : "boot-word"}
                style={{
                  color: WORD_COLORS[i] ?? "#fff4d6",
                  fontSize: "clamp(1.9rem, 6vw, 3.8rem)",
                  textShadow:
                    "0 0 1px rgba(255,255,255,0.55), 0 0 14px rgba(255,255,255,0.18)",
                  WebkitTextStroke: "0.4px rgba(255,255,255,0.22)",
                  animationDelay: reduced ? undefined : `${0.5 + i * 0.18}s`,
                }}
              >
                {w}
              </span>
            ))}
          </h1>
          <span
            className={reduced ? "boot-word-static" : "boot-word"}
            style={{
              marginTop: 8,
              color: "#9fe9d4",
              fontFamily: "'Caveat', cursive",
              fontSize: "clamp(1rem, 2.8vw, 1.5rem)",
              opacity: 0.95,
              animationDelay: reduced ? undefined : `${0.5 + titleWords.length * 0.18}s`,
            }}
          >
            Let's learn something fun today ✏️
          </span>
        </div>
      </div>

      <style>{`
        @keyframes boot-bird-in {
          0%   { transform: translateX(-130px) translateY(10px) rotate(-14deg) scale(0.78); opacity: 0; }
          50%  { opacity: 1; }
          62%  { transform: translateX(12px) translateY(-10px) rotate(4deg) scale(1.06); }
          78%  { transform: translateX(-2px) translateY(4px) rotate(-2deg) scale(0.99); }
          100% { transform: translateX(0) translateY(0) rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes boot-cap-in {
          0%, 40% { transform: translateY(-22px) rotate(-18deg); opacity: 0; }
          70%     { transform: translateY(2px) rotate(6deg); opacity: 1; }
          100%    { transform: translateY(0) rotate(-4deg); opacity: 1; }
        }
        @keyframes boot-word-in {
          0%   { transform: translateX(28px) translateY(6px); opacity: 0; filter: blur(3px); }
          100% { transform: translateX(0) translateY(0); opacity: 1; filter: blur(0); }
        }
        @keyframes boot-doodle-float {
          0%   { transform: translateY(8px) scale(0.9); opacity: 0; }
          20%  { opacity: 0.85; }
          80%  { opacity: 0.85; }
          100% { transform: translateY(-26px) scale(1.05); opacity: 0; }
        }
        .boot-bird {
          animation: boot-bird-in 1.05s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .boot-cap {
          animation: boot-cap-in 1.1s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .boot-word {
          opacity: 0;
          animation: boot-word-in 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .boot-word-static { opacity: 1; }
        .boot-doodle {
          animation-name: boot-doodle-float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          opacity: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .boot-bird, .boot-cap, .boot-word, .boot-doodle {
            animation: none !important; opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
