import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  BOOT_POSE as POSE,
  BOOT_CAP_IMG as CAP_IMG,
  BOOT_T as T,
  bootTitleName,
  poseForPhase,
  capFlyingForPhase,
  homeschoolStateForPhase,
  type BootPoseKey as PoseKey,
  type BootPhase as Phase,
} from "@shared/bootSplash";

/**
 * BootSplash — "Reagan's Homeschool" animated welcome (storyboard-accurate redesign)
 * ----------------------------------------------------------------------------------
 * Katy's 9-frame storyboard (2026-06-19). A smooth, video-style intro built from
 * five real 3D cap-budgie pose renders that cross-fade into one another, on a
 * bright WHITE studio background. Plays once per session.
 *
 *   Beat 1  Kiwi (cap on) gives a warm wave — bright white stage.
 *   Beat 2  An arched, black marker "REAGAN'S" writes on letter-by-letter at the
 *           top, child-like and bouncy.
 *   Beat 3  Kiwi winds up and FLINGS the cap off her head with her wing.
 *   Beat 4  The cap arcs up-and-left with a soft motion trail; Kiwi looks up and
 *           tracks it (wings raised).
 *   Beat 5  The cap falls down to the right; Kiwi looks down following it as it
 *           settles. "HOMESCHOOL" fades in DIMMED below.
 *   Beat 6  Kiwi pops the cap back on, turns to the viewer and WINKS while
 *           "HOMESCHOOL" lights up to full two-tone color: HOME (teal) +
 *           SCHOOL (golden-yellow). Final logo lockup, then a gentle fade-out.
 *
 * Fidelity notes:
 *   - Poses are real renders of the cute fluffy budgie Kiwi is based on, matched
 *     to the website's bird. Transitions are opacity cross-fades (no choppy snap)
 *     plus a gentle continuous breathe/bob so the whole thing reads as one fluid
 *     clip rather than a slideshow.
 *   - Fonts: "Permanent Marker" for the arched name, "Fredoka" (chunky rounded)
 *     for HOMESCHOOL — both loaded in index.html.
 *
 * Behaviour: once per session (sessionStorage); tap/any key to skip; respects
 * prefers-reduced-motion (jumps to the final lockup, then auto-dismisses).
 */

const SESSION_KEY = "bootSplashSeen";

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
  const nameWord = useMemo(
    () => bootTitleName(profile.data?.studentName),
    [profile.data?.studentName],
  );

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
      // Reduced motion: jump straight to the final lockup, then dismiss.
      setPhase("wink");
      push(() => beginLeave(), 4200);
    } else {
      push(() => setPhase("windup"), T.windup);
      push(() => setPhase("fling"), T.fling);
      push(() => setPhase("lookdown"), T.lookdown);
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

  // Which pose image is on top right now (the others fade beneath it).
  const activePose: PoseKey = poseForPhase(phase);

  const nameWriting = phase !== "wave"; // name starts writing after the wave
  const capFlying = capFlyingForPhase(phase);
  const hsState = homeschoolStateForPhase(phase);
  const homeschoolDim = hsState === "dim";
  const homeschoolLit = hsState === "lit";

  return (
    <div
      role="dialog"
      aria-label={`${nameWord} Homeschool — loading`}
      onClick={beginLeave}
      className="boot-splash fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden cursor-pointer"
      style={{
        opacity: leaving ? 0 : 1,
        transition: `opacity ${T.fade}ms ease`,
        // Bright white studio: soft warm vignette + a faint floor shadow gradient.
        backgroundColor: "#ffffff",
        background:
          "radial-gradient(ellipse at 50% 30%, #ffffff 0%, #fbfdff 55%, #eef4f5 100%)",
      }}
    >
      {/* soft floating school doodles (very subtle, behind everything) */}
      {!reduced && (
        <div aria-hidden className="boot-doodles">
          <span className="boot-doodle d1">{"\u270F\uFE0F"}</span>
          <span className="boot-doodle d2">{"\u2B50"}</span>
          <span className="boot-doodle d3">{"\uD83D\uDCDA"}</span>
          <span className="boot-doodle d4">{"\u2728"}</span>
          <span className="boot-doodle d5">{"\uD83C\uDF31"}</span>
          <span className="boot-doodle d6">{"\u2795"}</span>
        </div>
      )}

      {/* Stage: a compact centered lockup so the arched name, the hero bird, and
          HOMESCHOOL read as ONE unit (not scattered across a sea of white). The
          absolute choreography is percentage-based, so it scales with the box. */}
      <div
        className="relative"
        style={{ width: "min(92vw, 560px)", height: "min(88vh, 600px)" }}
      >
        {/* Arched handwritten name — writes on letter-by-letter along an arch. */}
        <div
          aria-hidden
          className="absolute left-0 right-0"
          style={{ top: "0%", height: "20%" }}
        >
          {letters.map((ch, i) => {
            const n = letters.length;
            const t = n > 1 ? i / (n - 1) : 0.5;
            const x = 16 + t * 68; // % across
            const arch = -Math.sin(t * Math.PI) * 30; // px lift in the middle
            const rot = (t - 0.5) * 18; // slight rotation along the arch
            const delay = T.write + 60 + i * 90; // ms; letter-by-letter
            return (
              <span
                key={`${ch}-${i}`}
                className={
                  reduced
                    ? "boot-letter-static"
                    : nameWriting
                    ? "boot-letter"
                    : "boot-letter-hidden"
                }
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `calc(60% + ${arch}px)`,
                  transform: `translate(-50%,-50%) rotate(${rot}deg)`,
                  fontFamily: "'Permanent Marker', 'Caveat', cursive",
                  fontWeight: 400,
                  fontSize: "clamp(2.6rem, 9.5vw, 6rem)",
                  color: "#1c1c1e", // bold black marker
                  textShadow: "0 2px 0 rgba(0,0,0,0.06)",
                  animationDelay: reduced ? undefined : `${delay}ms`,
                  whiteSpace: "pre",
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>

        {/* Kiwi pose stack — all five renders layered; the active one fades to
            full opacity while the rest fade out, giving fluid pose-to-pose
            morphing. A continuous breathe/bob wraps the stack. */}
        <div
          className={reduced ? "boot-stage" : "boot-stage boot-breathe"}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: "min(86vw, 540px)",
            height: "min(70vh, 540px)",
            filter: "drop-shadow(0 18px 26px rgba(40,80,80,0.18))",
          }}
        >
          {(Object.keys(POSE) as PoseKey[]).map((key) => (
            <img
              key={key}
              src={POSE[key]}
              alt={key === activePose ? "Kiwi, ready for school" : ""}
              aria-hidden={key !== activePose}
              draggable={false}
              className="boot-pose"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                opacity: key === activePose ? 1 : 0,
                transition: "opacity 360ms ease",
                userSelect: "none",
              }}
            />
          ))}
        </div>

        {/* The flying graduation cap — launches up-left with a motion trail, then
            falls down-right past Kiwi. Hidden once she's wearing it again. */}
        <img
          aria-hidden
          src={CAP_IMG}
          alt=""
          draggable={false}
          className={
            reduced ? "boot-cap-hidden" : capFlying ? "boot-cap-fly" : "boot-cap-hidden"
          }
          style={{
            position: "absolute",
            left: "50%",
            top: "40%",
            width: "clamp(80px, 16vw, 170px)",
            transform: "translate(-50%,-50%)",
            filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.18))",
          }}
        />

        {/* HOMESCHOOL — two-tone, chunky rounded. Fades in dimmed, then lights up
            to full teal + golden-yellow. */}
        <div
          className="absolute left-0 right-0 flex justify-center"
          style={{ top: "88%" }}
        >
          <span
            className={
              reduced
                ? "boot-hs-lit"
                : homeschoolLit
                ? "boot-hs-lit"
                : homeschoolDim
                ? "boot-hs-dim"
                : "boot-hs-hidden"
            }
            style={{
              fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
              fontWeight: 700,
              letterSpacing: "0.01em",
              fontSize: "clamp(2.1rem, 8.5vw, 4.6rem)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            <span className="boot-hs-home">HOME</span>
            <span className="boot-hs-school">SCHOOL</span>
          </span>
        </div>
      </div>

      <style>{`
        /* ---- Name: letter-by-letter write-on ---- */
        @keyframes boot-letter-in {
          0%   { opacity: 0; transform: translate(-50%,-60%) scale(0.6) rotate(var(--r,0deg)); }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: translate(-50%,-50%) scale(1) rotate(var(--r,0deg)); }
        }
        .boot-letter-hidden { opacity: 0; }
        .boot-letter {
          opacity: 0;
          animation: boot-letter-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .boot-letter-static { opacity: 1; }

        /* ---- Continuous gentle breathe/bob so it reads as one fluid clip ---- */
        @keyframes boot-breathe {
          0%,100% { transform: translate(-50%,-50%) translateY(0) scale(1); }
          50%     { transform: translate(-50%,-50%) translateY(-8px) scale(1.012); }
        }
        .boot-breathe { animation: boot-breathe 3.2s ease-in-out infinite; }

        /* ---- Cap flight: launch up-left with trail, peak, fall down-right ---- */
        @keyframes boot-cap-flight {
          0%   { opacity: 0; transform: translate(-50%,-50%) rotate(-10deg) scale(0.7); }
          8%   { opacity: 1; }
          34%  { transform: translate(-150%,-150%) rotate(220deg) scale(0.78); }   /* up-left peak */
          60%  { transform: translate(40%,-40%) rotate(430deg) scale(0.9); }       /* arc over to the right */
          100% { opacity: 1; transform: translate(150%,150%) rotate(640deg) scale(1); } /* fall down-right, off-stage */
        }
        .boot-cap-hidden { opacity: 0; }
        .boot-cap-fly {
          animation: boot-cap-flight 2.2s cubic-bezier(0.42,0,0.4,1) both;
          /* soft motion trail */
          filter: drop-shadow(0 6px 8px rgba(0,0,0,0.18)) drop-shadow(-10px -8px 10px rgba(120,160,160,0.25));
        }

        /* ---- HOMESCHOOL two-tone ---- */
        .boot-hs-home, .boot-hs-school {
          transition: color 600ms ease, text-shadow 600ms ease;
        }
        @keyframes boot-hs-pop {
          0%   { opacity: 0; transform: translateY(14px) scale(0.9); }
          60%  { opacity: 1; transform: translateY(-3px) scale(1.04); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .boot-hs-hidden { opacity: 0; }
        /* Dimmed: muted grey, no 3D yet */
        .boot-hs-dim {
          animation: boot-hs-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .boot-hs-dim .boot-hs-home,
        .boot-hs-dim .boot-hs-school {
          color: #c2cdcb;
          text-shadow: 0 1px 0 #b3bfbd;
        }
        /* Lit: full two-tone with a soft bubble depth */
        .boot-hs-lit { opacity: 1; }
        .boot-hs-lit .boot-hs-home {
          color: #2f9e8f; /* teal */
          text-shadow: 0 1px 0 #248577, 0 2px 0 #1d7568, 0 4px 8px rgba(31,86,88,0.28);
        }
        .boot-hs-lit .boot-hs-school {
          color: #f5b916; /* golden-yellow */
          text-shadow: 0 1px 0 #e0a40e, 0 2px 0 #c79009, 0 4px 8px rgba(120,90,10,0.22);
        }

        /* ---- Floating school doodles ---- */
        .boot-doodles { position: absolute; inset: 0; pointer-events: none; }
        .boot-doodle {
          position: absolute;
          font-size: clamp(20px, 3vw, 34px);
          opacity: 0.18;
          animation: boot-float 7s ease-in-out infinite;
        }
        @keyframes boot-float {
          0%,100% { transform: translateY(0) rotate(-4deg); }
          50%     { transform: translateY(-16px) rotate(6deg); }
        }
        .boot-doodle.d1 { left: 9%;  top: 22%; animation-delay: 0s;   }
        .boot-doodle.d2 { left: 86%; top: 18%; animation-delay: 0.8s; }
        .boot-doodle.d3 { left: 14%; top: 70%; animation-delay: 1.6s; }
        .boot-doodle.d4 { left: 82%; top: 64%; animation-delay: 2.2s; }
        .boot-doodle.d5 { left: 50%; top: 90%; animation-delay: 1.1s; }
        .boot-doodle.d6 { left: 70%; top: 40%; animation-delay: 2.8s; }

        @media (prefers-reduced-motion: reduce) {
          .boot-letter, .boot-cap-fly, .boot-breathe, .boot-hs-dim,
          .boot-doodle {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
