import { useEffect, useMemo, useRef, useState } from "react";
import KiwiSprite, { type KiwiPose } from "./KiwiSprite";
import { trpc } from "@/lib/trpc";

/**
 * BootSplash — "Reagan's Homeschool" cap-toss welcome
 * ---------------------------------------------------
 * Katy's storyboard (2026-06-19). A choreographed, school-themed intro shown on
 * the FIRST app mount of a session:
 *
 *   Frame 1  Kiwi centered on the solid homeschool (dark chalkboard-green)
 *            background, graduation cap on her head, gives a friendly wave.
 *   Frame 2  Kiwi "throws" the cap; as the cap arcs UP it magically writes the
 *            possessive name (e.g. "Reagan's") on letter-by-letter, in an arched,
 *            child-like handwritten script following the cap's path.
 *   Frame 3  The cap peaks; Kiwi looks up and tracks it.
 *   Frame 4  The cap falls straight down to Kiwi's right, past her feet, and off
 *            the bottom. The instant it passes her feet, "HOMESCHOOL" fades in
 *            all-at-once below her in a 3D bubble all-caps style that matches
 *            Kiwi's real green/yellow palette.
 *   Frame 5  Cap gone, Kiwi turns back to the viewer, smiles + winks, then the
 *            whole splash fades out.
 *
 * Notes on fidelity:
 *   - Kiwi is the EXACT same sprite asset used across the site (KiwiSprite), so
 *     the bird's colors match the website one-to-one. The "HOMESCHOOL" 3D text
 *     palette is sampled from the REAL bird Kiwi is designed after — a blue/yellow
 *     budgie (yellow head #f5e25e + turquoise body #6aa8a4/#4f9494/#357c7e + deep
 *     teal outline #1f5658) — so text + bird read as one set.
 *   - Kiwi's art has no literal "wave/throw/wink" frames, so motion is conveyed
 *     with pose swaps (flap/chirp/idle) + CSS transforms and a wink flash.
 *
 * Behaviour: plays once per session (sessionStorage), tap/any-key to skip,
 * respects prefers-reduced-motion (static final state, quick auto-dismiss).
 */

const SESSION_KEY = "bootSplashSeen";

/** Possessive form: "Reagan" -> "Reagan’s", "Chris" -> "Chris’". */
function possessive(name: string): string {
  const n = name.trim();
  if (!n) return "";
  return /s$/i.test(n) ? `${n}\u2019` : `${n}\u2019s`;
}

// Choreography timeline (ms from mount). Tuned so the cap's flight and the
// writing/fade triggers line up.
const T = {
  wave: 250,        // Frame 1: Kiwi waves
  throw: 1150,      // Frame 2: cap launches + name starts writing
  peak: 1850,       // Frame 3: cap at apex, Kiwi looks up
  fall: 1950,       // Frame 4: cap begins falling
  homeschool: 2750, // "HOMESCHOOL" fades in as cap passes the feet
  wink: 3450,       // Frame 5: Kiwi turns back + winks
  hold: 4300,       // begin fade-out
  fade: 520,
};

type Phase = "wave" | "throw" | "peak" | "fall" | "homeschool" | "wink";

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
  const [phase, setPhase] = useState<Phase>("wave");
  const timers = useRef<number[]>([]);

  // Student name from app settings (public profile query). Fallback "Reagan"
  // while it loads so the splash never flashes a blank title.
  const profile = trpc.profile.get.useQuery(undefined, { enabled: show });
  const nameWord = useMemo(() => {
    const full = (profile.data?.studentName || "Reagan").trim();
    const first = full.split(/\s+/)[0] || "Reagan";
    return possessive(first);
  }, [profile.data?.studentName]);

  // Per-letter spans for the handwritten arch.
  const letters = useMemo(() => Array.from(nameWord), [nameWord]);

  useEffect(() => {
    if (!show) return;
    try {
      setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      /* ignore */
    }
  }, [show]);

  // Mark seen + run the timeline.
  useEffect(() => {
    if (!show) return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }

    const push = (fn: () => void, ms: number) =>
      timers.current.push(window.setTimeout(fn, ms));

    if (reduced) {
      // Reduced motion: show the resolved state, then dismiss.
      setPhase("homeschool");
      push(() => beginLeave(), 1400);
    } else {
      push(() => setPhase("throw"), T.throw);
      push(() => setPhase("peak"), T.peak);
      push(() => setPhase("fall"), T.fall);
      push(() => setPhase("homeschool"), T.homeschool);
      push(() => setPhase("wink"), T.wink);
      push(() => beginLeave(), T.hold);
    }
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reduced]);

  // Skip on tap / key.
  useEffect(() => {
    if (!show) return;
    const onKey = () => beginLeave();
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  function beginLeave() {
    setLeaving(true);
    window.setTimeout(() => setShow(false), T.fade);
  }

  if (!show) return null;

  // Pose: wave/throw use flap (wings up), peak/fall idle (looking up handled by
  // CSS tilt), wink uses chirp (eyes-closed-ish happy pose).
  const pose: KiwiPose =
    phase === "wave" || phase === "throw"
      ? "flap"
      : phase === "wink"
      ? "chirp"
      : "idle";

  const nameVisible = phase !== "wave"; // name starts writing at throw
  const homeschoolVisible = phase === "homeschool" || phase === "wink";
  const capLaunched = phase !== "wave";

  return (
    <div
      role="dialog"
      aria-label={`${nameWord} Homeschool — loading`}
      onClick={beginLeave}
      className="boot-splash fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden cursor-pointer"
      style={{
        opacity: leaving ? 0 : 1,
        transition: `opacity ${T.fade}ms ease`,
        // Deep teal-navy backdrop that harmonizes with Kiwi's real blue/yellow
        // budgie palette (yellow head + turquoise body).
        background:
          "radial-gradient(ellipse at 50% 38%, rgba(96,176,176,0.16), transparent 62%)," +
          "linear-gradient(160deg, #11302f 0%, #143a3c 45%, #0c2122 100%)",
      }}
    >
      {/* Stage: fixed-size so absolute choreography lines up across breakpoints */}
      <div
        className="relative"
        style={{ width: "min(92vw, 460px)", height: "min(70vh, 460px)" }}
      >
        {/* Arched handwritten name — writes on letter-by-letter, following the
            cap's upward arc. Positioned across the top. */}
        <div
          aria-hidden
          className="absolute left-0 right-0"
          style={{ top: "4%", height: "34%" }}
        >
          {letters.map((ch, i) => {
            const n = letters.length;
            // Distribute letters along a shallow arch (parabola): center high.
            const t = n > 1 ? i / (n - 1) : 0.5;
            const x = 12 + t * 76; // % across
            const arch = -Math.sin(t * Math.PI) * 26; // px lift in the middle
            const rot = (t - 0.5) * 16; // slight rotation along the arch
            const delay = T.throw + 80 + i * 95; // ms; letter-by-letter
            return (
              <span
                key={`${ch}-${i}`}
                className={reduced ? "boot-letter-static" : "boot-letter"}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `calc(38% + ${arch}px)`,
                  transform: `translate(-50%,-50%) rotate(${rot}deg)`,
                  fontFamily: "'Caveat', cursive",
                  fontWeight: 700,
                  fontSize: "clamp(2.4rem, 9vw, 4.2rem)",
                  // Warm cream-yellow to echo Kiwi's yellow head.
                  color: "#fdf0a8",
                  textShadow:
                    "0 1px 0 rgba(0,0,0,0.3), 0 0 16px rgba(245,224,96,0.35)",
                  animationDelay: reduced ? undefined : `${delay}ms`,
                  whiteSpace: "pre",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>

        {/* Kiwi — exact site sprite. Centered; tilts up to track the cap. */}
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "52%",
            transform: "translate(-50%,-50%)",
            transformOrigin: "center bottom",
            filter: "drop-shadow(0 12px 26px rgba(0,0,0,0.45))",
          }}
        >
          <div
            className={
              reduced
                ? ""
                : phase === "wave"
                ? "boot-kiwi-wave"
                : phase === "peak" || phase === "fall"
                ? "boot-kiwi-lookup"
                : phase === "wink"
                ? "boot-kiwi-settle"
                : ""
            }
          >
            <KiwiSprite
              pose={pose}
              size={150}
              animate={!reduced}
              ariaLabel="Kiwi, ready for school"
            />
          </div>

          {/* Wink flash overlay (Frame 5) */}
          {!reduced && phase === "wink" && (
            <span aria-hidden className="boot-wink" />
          )}
        </div>

        {/* The graduation cap. Sits on Kiwi's head in Frame 1; on throw it
            launches up along an arc, peaks, then falls to her right past the
            feet and off the bottom. */}
        <span
          aria-hidden
          className={
            reduced
              ? "boot-cap-static"
              : capLaunched
              ? "boot-cap-fly"
              : "boot-cap-rest"
          }
          style={{
            position: "absolute",
            left: "50%",
            top: "30%",
            fontSize: 56,
            lineHeight: 1,
            transform: "translate(-50%,-50%)",
            filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.4))",
            // Hide once it has exited (after the fall completes).
            opacity: phase === "homeschool" || phase === "wink" ? 0 : 1,
          }}
        >
          {"\u{1F393}"}
        </span>

        {/* HOMESCHOOL — 3D bubble, all caps, Kiwi's green/yellow palette. Fades
            in all-at-once as the cap passes the feet. */}
        <div
          className="absolute left-0 right-0 flex justify-center"
          style={{ top: "78%" }}
        >
          <span
            className={
              homeschoolVisible
                ? reduced
                  ? "boot-homeschool-static"
                  : "boot-homeschool-in"
                : "boot-homeschool-hidden"
            }
            style={{
              fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
              fontWeight: 700,
              letterSpacing: "0.04em",
              fontSize: "clamp(1.5rem, 6.5vw, 3rem)",
              // Kiwi's yellow head color for the face of the letters.
              color: "#f5e25e",
              // 3D bubble: layered shadows transition yellow -> turquoise (Kiwi's
              // body) for depth, with a deep teal outline so it pops.
              textShadow: [
                "0 1px 0 #d8c84a",
                "0 2px 0 #8fb8a8",
                "0 3px 0 #6aa8a4",
                "0 4px 0 #4f9494",
                "0 5px 0 #357c7e",
                "0 6px 1px rgba(0,0,0,0.35)",
                "0 7px 12px rgba(0,0,0,0.5)",
              ].join(","),
              WebkitTextStroke: "1px #1f5658",
              paintOrder: "stroke fill",
            }}
          >
            HOMESCHOOL
          </span>
        </div>
      </div>

      <style>{`
        /* ---- Name: letter-by-letter write-on ---- */
        @keyframes boot-letter-in {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.6) rotate(var(--r,0deg)); filter: blur(2px); }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: translate(-50%,-50%) scale(1) rotate(var(--r,0deg)); filter: blur(0); }
        }
        .boot-letter {
          opacity: 0;
          animation: boot-letter-in 0.42s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .boot-letter-static { opacity: 1; }

        /* ---- Kiwi motion ---- */
        @keyframes boot-wave {
          0%,100% { transform: rotate(0deg); }
          25%     { transform: rotate(-7deg) translateY(-2px); }
          50%     { transform: rotate(6deg); }
          75%     { transform: rotate(-4deg); }
        }
        @keyframes boot-lookup {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(-8deg) translateY(-2px); }
        }
        @keyframes boot-settle {
          0%   { transform: rotate(-8deg); }
          60%  { transform: rotate(3deg) scale(1.04); }
          100% { transform: rotate(0deg) scale(1); }
        }
        .boot-kiwi-wave   { animation: boot-wave 0.9s ease-in-out 1 both; transform-origin: center bottom; }
        .boot-kiwi-lookup { animation: boot-lookup 0.5s ease-out both; transform-origin: center bottom; }
        .boot-kiwi-settle { animation: boot-settle 0.6s cubic-bezier(0.34,1.56,0.64,1) both; transform-origin: center bottom; }

        /* ---- Wink flash ---- */
        @keyframes boot-wink-flash {
          0%   { opacity: 0; transform: translate(40px,42px) scale(0.4) rotate(-10deg); }
          30%  { opacity: 1; }
          100% { opacity: 0; transform: translate(48px,30px) scale(1) rotate(8deg); }
        }
        .boot-wink {
          position: absolute;
          left: 58%; top: 30%;
          width: 16px; height: 16px;
          background:
            radial-gradient(circle, #fff 0 30%, transparent 32%),
            conic-gradient(from 0deg, transparent 0 15deg, #fff 15deg 18deg, transparent 18deg 90deg, #fff 90deg 93deg, transparent 93deg);
          filter: drop-shadow(0 0 6px rgba(255,255,255,0.9));
          animation: boot-wink-flash 0.7s ease-out both;
          pointer-events: none;
        }

        /* ---- Cap flight: launch up, arc, peak, fall past feet, exit bottom ---- */
        @keyframes boot-cap-flight {
          0%   { transform: translate(-50%,-50%) rotate(-12deg) scale(1); }      /* launch */
          26%  { transform: translate(-30%,-220%) rotate(180deg) scale(0.92); }   /* rising right + spin */
          40%  { transform: translate(0%,-300%) rotate(320deg) scale(0.9); }      /* PEAK */
          55%  { transform: translate(40%,-210%) rotate(430deg) scale(0.92); }    /* start falling, drift right */
          100% { transform: translate(120%,260%) rotate(620deg) scale(1.02); }    /* fall past feet, exit bottom-right */
        }
        .boot-cap-rest   { animation: none; }
        .boot-cap-static { top: 22% !important; }
        .boot-cap-fly {
          animation: boot-cap-flight 1.6s cubic-bezier(0.45,0.05,0.55,0.95) both;
        }

        /* ---- HOMESCHOOL fade-in (all at once) ---- */
        @keyframes boot-homeschool-pop {
          0%   { opacity: 0; transform: translateY(10px) scale(0.92); }
          60%  { opacity: 1; transform: translateY(-2px) scale(1.03); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .boot-homeschool-hidden { opacity: 0; }
        .boot-homeschool-static { opacity: 1; }
        .boot-homeschool-in {
          animation: boot-homeschool-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .boot-letter, .boot-cap-fly, .boot-kiwi-wave, .boot-kiwi-lookup,
          .boot-kiwi-settle, .boot-homeschool-in, .boot-wink {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
