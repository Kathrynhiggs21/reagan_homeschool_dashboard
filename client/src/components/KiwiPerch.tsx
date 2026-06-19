import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import KiwiSprite, { type KiwiPose, KIWI_ACTIVITY_POSES, KIWI_ACTIVITY_BUBBLES } from "./KiwiSprite";
import FlockSprite, { type FlockMember, getFlockMeta } from "./FlockSprite";
import { useKiwi } from "@/contexts/KiwiContext";
import { trpc } from "@/lib/trpc";
import {
  resolveKiwiDayCharacter,
  resolveKiwiMoment,
  resolveKiwiSocial,
  kiwiProjectForTick,
  ALL_PROJECT_KINDS,
  type KiwiCostume,
  type KiwiSocialMoment,
} from "@shared/kiwiCharacter";
import { findLedges } from "@/lib/kiwiWorld";
// Kiwi is silent by default. We deliberately do NOT import chirp() here so the
// perch never makes sound on its own. Voice/chirp only fires through KiwiCompanion
// (chat reply) and only when Mom has flipped Silent mode off in Settings.
import { popStickersAt, popStickersFromElement } from "@/lib/stickerBurst";

/**
 * KiwiPerch — the always-active Kiwi parakeet.
 *
 * Fix (Apr 29 PM): previous build left her stuck on "idle" because pose
 * transitions were deferred until 45-90s of true inactivity. Now she runs
 * on one short always-on tick (every ~2.5s) that rolls a tiny "action"
 * (bob / chirp / peck / flap / tilt) so Reagan actually sees her doing things.
 *
 * Behaviors
 * - Persistent action cycle every ~2.5s with weighted random pose changes
 * - Bob-hop (20-40px) every 6-10s, and larger flutter (60-120px) every 25-45s
 * - Fly-across the viewport every ~90s
 * - Draggable anywhere (pointer events, touch + mouse), position persists
 * - Mic-on pulsing dot when wake-word is active
 * - Sleep pose + slow breathing when adultPresent=true
 * - Reacts to user activity: flap briefly on any document mousemove/touchmove
 * - Respects prefers-reduced-motion by slowing everything ~3x
 */

type Pos = { x: number; y: number };

// Perch is smaller on mobile so it doesn't cover half the screen.
// 2026-06-18 (Katy): make Kiwi noticeably bigger on screen.
function perchSize(): number {
  if (typeof window === "undefined") return 120;
  return window.innerWidth < 640 ? 96 : 120;
}

// Routes treated as the "home screen" where Kiwi should start in the
// lower-right corner regardless of any older saved position.
function isHomeRoute(): boolean {
  if (typeof window === "undefined") return false;
  const p = (window.location.pathname || "/").replace(/\/+$/, "") || "/";
  return p === "/" || p === "/today" || p === "/home";
}

// Lower-right anchor for a given size.
function lowerRight(size: number): Pos {
  const w = typeof window !== "undefined" ? window.innerWidth : 1024;
  const h = typeof window !== "undefined" ? window.innerHeight : 768;
  return { x: Math.max(16, w - size - 20), y: Math.max(16, h - size - 28) };
}

// Per-route persistence so she doesn't block the same button on every page
function routeKey(): string {
  if (typeof window === "undefined") return "_global";
  const p = window.location.pathname || "/";
  return p.replace(/\/+$/, "") || "/";
}
const LS_PREFIX = "kiwiPerchPos:";

function loadPos(size: number): Pos {
  // On the home screen, Kiwi always STARTS in the lower-right corner. Reagan
  // can still drag her elsewhere afterward (that move is saved), but a fresh
  // load / first visit places her bottom-right as requested (2026-06-18).
  if (isHomeRoute()) {
    try {
      const seeded = localStorage.getItem(LS_PREFIX + "homeSeeded") === "1";
      const key = LS_PREFIX + routeKey();
      const raw = localStorage.getItem(key);
      if (seeded && raw) {
        const p = JSON.parse(raw);
        if (typeof p.x === "number" && typeof p.y === "number") return p;
      }
    } catch {}
    try { localStorage.setItem(LS_PREFIX + "homeSeeded", "1"); } catch {}
    return lowerRight(size);
  }
  try {
    const key = LS_PREFIX + routeKey();
    const raw = localStorage.getItem(key) || localStorage.getItem(LS_PREFIX + "_last");
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.x === "number" && typeof p.y === "number") return p;
    }
  } catch {}
  return lowerRight(size);
}

function clamp(p: Pos, size: number, chatOpen?: boolean): Pos {
  if (typeof window === "undefined") return p;
  const w = window.innerWidth;
  const h = window.innerHeight;
  let x = Math.max(8, Math.min(w - size - 8, p.x));
  let y = Math.max(8, Math.min(h - size - 8, p.y));
  // Keep Kiwi away from an open chat panel (bottom-center on mobile, right side on desktop)
  if (chatOpen) {
    if (w < 640) {
      // Chat takes the bottom ~420px on mobile; push her up
      if (y > h - size - 440) y = Math.max(8, h - size - 460);
    } else {
      // Chat anchors right; nudge her to the left third
      if (x > w * 0.45) x = Math.max(8, Math.min(x, w * 0.45));
    }
  }
  return { x, y };
}

// Friendly lines + auto-chirp arrays were intentionally removed. Kiwi only
// speaks/opens her bubble when the user taps her or says the wake word.
// (See KiwiCompanion.tsx for the wake-word path.)

export default function KiwiPerch() {
  const { enabled, open, setOpen, adultPresent, mode } = useKiwi();
  const [pose, setPose] = useState<KiwiPose>("idle");

  /* ---- Daily costume from the authoritative server resolver ----
   * kiwi.today combines today's appointments + holidays + summer/vacation
   * status so the costume is consistent everywhere and stable all day. We keep
   * a local fallback resolve (no events) so Kiwi still dresses if the query is
   * still loading or errors. */
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayChar = trpc.kiwi.today.useQuery(undefined, { staleTime: 10 * 60_000 });
  const dayChar = useMemo(
    () => todayChar.data ?? resolveKiwiDayCharacter(todayISO, {}),
    [todayChar.data, todayISO],
  );
  const costume: KiwiCostume = dayChar.costume;

  /* ---- Time-aware MOMENT (2026-06-19, Katy) ----
   * Kiwi used to wear the exact same look + say the same line all day. Now we
   * recompute a "moment" every ~15 min from the wall clock so her mood + idle
   * lines rotate across the day's 6 segments. A real costume (event / holiday /
   * vacation) still persists all day — only the everyday vibe rotates. */
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15 * 60_000);
    return () => window.clearInterval(id);
  }, []);
  const moment = useMemo(() => {
    const iso = new Date(nowTick).toISOString();
    return resolveKiwiMoment(iso, {
      eventTitles: (dayChar as any).eventTitles ?? [],
      onVacation: dayChar.onVacation,
      favoriteShowLabel: (dayChar as any).favoriteShowLabel,
    });
  }, [nowTick, dayChar]);
  // Mood drives a tiny accent ring + the rotating idle/funny line bank.
  const moodAccent = useMemo(() => {
    switch (moment.mood) {
      case "cozy": return "#f59e0b";
      case "sleepy": return "#818cf8";
      case "hyper": return "#22c55e";
      case "snacky": return "#fb923c";
      case "focused": return "#0ea5e9";
      case "chill": return "#a78bfa";
      default: return "#fbbf24";
    }
  }, [moment.mood]);
  const [size, setSize] = useState<number>(() => perchSize());
  const [pos, setPos] = useState<Pos>(() => loadPos(perchSize()));
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState(false);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [popBurst, setPopBurst] = useState<number>(0);
  const [tilt, setTilt] = useState(0); // degrees
  // Slow ambient project (nest / needlework / ...) that advances over a session.
  const [projectTick, setProjectTick] = useState(0);
  const projectKindRef = useRef(ALL_PROJECT_KINDS[Math.floor(Math.random() * ALL_PROJECT_KINDS.length)]!);
  // Flock cameo: occasionally, Blue / Daffy / Honk fly in for ~6s and hover
  // near Kiwi, then fade away. Silent, visual-only.
  const [cameo, setCameo] = useState<FlockMember | null>(null);
  // Social cameo: Lychee (best friend, often) or the duck trio (rare). Carries
  // an interaction beat (follow / bicker / preen / flyoff / waddle) + a banter
  // line. Driven by the deterministic resolveKiwiSocial schedule.
  const [social, setSocial] = useState<KiwiSocialMoment | null>(null);
  // Drifting feathers that peel off Kiwi on big flaps / takeoff.
  const [feathers, setFeathers] = useState<Array<{ id: number; color: string }>>([]);
  const featherIdRef = useRef(0);
  // Reduced-motion guard (declared early so all effects can use dropFeather).
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  // Drop a drifting feather off Kiwi. Visual-only, auto-cleans up, respects
  // reduced-motion (skips entirely). Called on big flaps / takeoff.
  const dropFeather = useCallback(() => {
    if (reducedMotion) return;
    // Kiwi feather palette (blue/yellow budgie) — vary a little for life.
    const colors = ["#f5e25e", "#6aa8a4", "#4f9494", "#357c7e"];
    const color = colors[Math.floor(Math.random() * colors.length)]!;
    const id = ++featherIdRef.current;
    setFeathers((prev) => [...prev.slice(-4), { id, color }]);
    window.setTimeout(() => {
      setFeathers((prev) => prev.filter((f) => f.id !== id));
    }, 3600);
  }, [reducedMotion]);
  const lastInteractRef = useRef(Date.now());
  const bubbleTimeoutRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  // Persist position per-route + keep a _last fallback
  useEffect(() => {
    try {
      const key = LS_PREFIX + routeKey();
      const s = JSON.stringify(pos);
      localStorage.setItem(key, s);
      localStorage.setItem(LS_PREFIX + "_last", s);
    } catch {}
  }, [pos]);

  // Reload position when route changes (listens for wouter/history popstate)
  useEffect(() => {
    const onNav = () => setPos(loadPos(size));
    window.addEventListener("popstate", onNav);
    return () => window.removeEventListener("popstate", onNav);
  }, [size]);

  // Reclamp on resize + re-evaluate mobile size
  useEffect(() => {
    const onResize = () => {
      const s = perchSize();
      setSize(s);
      setPos((p) => clamp(p, s, open));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  // Re-clamp when chat opens/closes so she dodges the panel
  useEffect(() => {
    setPos((p) => clamp(p, size, open));
  }, [open, size]);

  /* ============================ MAIN ACTION LOOP ============================
   * Runs ALL the time. Picks a random micro-action every ~2.5s so Kiwi is
   * visibly doing things — this is the core of the "feels alive" fix.
   */
  useEffect(() => {
    if (!enabled) return;
    if (adultPresent) {
      // Shh — Kiwi naps while adult is present.
      setPose("sleep");
      return;
    }
    const tick = () => {
      if (dragging || flying) return;
      // Weighted pick
      const roll = Math.random();
      if (roll < 0.28) {
        // Head-tilt wiggle
        setTilt((Math.random() - 0.5) * 14);
        setPose("idle");
        window.setTimeout(() => setTilt(0), 700);
      } else if (roll < 0.55) {
        // Small bob-hop
        setPose("flap");
        setPos((p) => clamp({ x: p.x + (Math.random() - 0.5) * 40, y: p.y - 12 }, size, open));
        window.setTimeout(() => setPos((p) => clamp({ x: p.x, y: p.y + 12 }, size, open)), 280);
        window.setTimeout(() => setPose("idle"), 520);
      } else if (roll < 0.78) {
        // Silent peck/chirp pose only — no bubble, no sound
        setPose("chirp");
        window.setTimeout(() => setPose("idle"), 700);
      } else if (roll < 0.9) {
        // Peck — quick chirp→idle flash
        setPose("chirp");
        window.setTimeout(() => setPose("idle"), 220);
        window.setTimeout(() => setPose("chirp"), 360);
        window.setTimeout(() => setPose("idle"), 520);
      } else {
        // Blink-only (no pose change, just a brief reset to idle)
        setPose("idle");
      }
    };
    const interval = window.setInterval(tick, 2500);
    // Fire once immediately so you see motion right away
    window.setTimeout(tick, 300);
    return () => window.clearInterval(interval);
  }, [enabled, adultPresent, dragging, flying]);

  /* ======================== ACTIVITY POSE CYCLING ===========================
   * Every 15-30s, Kiwi switches to a random activity pose for ~8-12s, then
   * returns to idle. A speech bubble shows what she's doing. This makes her
   * feel like a real companion with her own life.
   */
  useEffect(() => {
    if (!enabled || adultPresent) return;
    let timer: number;
    const schedule = () => {
      const delay = 15_000 + Math.random() * 15_000; // 15-30s between activities
      timer = window.setTimeout(() => {
        if (!dragging && !flying) {
          // Pick a random activity pose
          const pick = KIWI_ACTIVITY_POSES[Math.floor(Math.random() * KIWI_ACTIVITY_POSES.length)];
          setPose(pick);
          // Show a speech bubble. ~45% of the time use the TIME-AWARE moment
          // line (dawn/morning/.../night) so Kiwi's chatter visibly shifts
          // through the day; otherwise the pose-specific activity line.
          const useMomentLine = Math.random() < 0.45;
          const bubbleMsg = useMomentLine
            ? (moment.idleLine || KIWI_ACTIVITY_BUBBLES[pick])
            : KIWI_ACTIVITY_BUBBLES[pick];
          if (bubbleMsg) {
            setBubbleText(bubbleMsg);
            if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
            bubbleTimeoutRef.current = window.setTimeout(() => setBubbleText(null), 4000);
          }
          // Hold the activity pose for 8-12s, then return to idle
          const holdDuration = 8_000 + Math.random() * 4_000;
          window.setTimeout(() => {
            setPose("idle");
          }, holdDuration);
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [enabled, adultPresent, dragging, flying, moment]);

  // Medium flutter hop every 25-45s: bigger movement
  useEffect(() => {
    if (!enabled || adultPresent) return;
    let timer: number;
    const schedule = () => {
      const delay = 25_000 + Math.random() * 20_000;
      timer = window.setTimeout(() => {
        if (!dragging && !flying) {
          setPose("flap");
          // A big flutter is a "takeoff" — sometimes a feather drifts off.
          if (Math.random() < 0.6) dropFeather();
          setPos((p) => clamp({
            x: p.x + (Math.random() - 0.5) * 200,
            y: p.y + (Math.random() - 0.5) * 120,
          }, size, open));
          window.setTimeout(() => setPose("idle"), 600);
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [enabled, adultPresent, dragging, flying, dropFeather, size, open]);

  // Reusable fly-across action. Used by both the 90-150s timer and the
  // tap-to-fly trigger (double-tap on Kiwi or programmatic flyKiwi() call).
  // Exposed via ref so the imperative tap handler can call it.
  const flyAcrossRef = useRef<(() => void) | null>(null);
  // Fly-across (airplane whoosh) action DISABLED per Katy (2026-06-18). Kiwi
  // still roams/idles and is draggable; we just no longer launch the
  // across-the-screen flight. Kept as a no-op ref so existing callers
  // (double-tap, window.flyKiwi, celebration toasts) are harmless.
  flyAcrossRef.current = () => {};

  // Programmatic trigger: window.flyKiwi() lets ANY page call it (e.g. from
  // a celebration toast "Kiwi flew across the room!").
  useEffect(() => {
    (window as any).flyKiwi = () => flyAcrossRef.current?.();
    return () => { try { delete (window as any).flyKiwi; } catch {} };
  }, []);

  // Periodic fly-across DISABLED per Katy (2026-06-18). Kiwi stays put /
  // roams gently instead of launching across the screen on a timer.

  // Sleep when adult present
  useEffect(() => {
    if (adultPresent) setPose("sleep");
    else if (pose === "sleep") setPose("idle");
  }, [adultPresent]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ======================== SOCIAL WORLD CAMEO LOOP ========================
   * Lychee (Kiwi's best friend) visits OFTEN; the duck trio drops by rarely.
   * The deterministic resolveKiwiSocial() decides who's around for the current
   * 2-hour window, plus an interaction beat (follow / bicker / preen / flyoff /
   * waddle). We surface that here as a ~7s cameo with a banter bubble, and we
   * also still occasionally show a quieter Blue/Daffy/Honk fly-by for variety.
   */
  useEffect(() => {
    if (!enabled || adultPresent) return;
    let timer: number | undefined;
    const otherFriends: FlockMember[] = ["blue", "daffy", "honk"];
    const schedule = () => {
      // Lychee comes by often, so keep the cadence fairly lively.
      const delay = 45_000 + Math.random() * 70_000;
      timer = window.setTimeout(() => {
        if (!dragging && !flying) {
          const nowIso = new Date().toISOString();
          const soc = resolveKiwiSocial(nowIso);
          if (soc.guestId) {
            setSocial(soc);
            const member: FlockMember = soc.guestId === "ducks" ? "ducks" : "lychee";
            setCameo(member);
            // Show the banter line as a bubble.
            if (soc.line) {
              setBubbleText(soc.line);
              if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
              bubbleTimeoutRef.current = window.setTimeout(() => setBubbleText(null), 5200);
            }
            // Kiwi reacts to the beat.
            if (soc.beat === "flyoff") {
              setPose("flap");
              dropFeather();
              window.setTimeout(() => setPose("idle"), 900);
            } else {
              setPose("chirp");
              window.setTimeout(() => setPose("idle"), 700);
            }
            // Clear the cameo after ~7s (ducks linger a touch longer).
            const hold = soc.guestId === "ducks" ? 7_600 : 6_800;
            window.setTimeout(() => { setCameo(null); setSocial(null); }, hold);
          } else {
            // No scheduled guest this window — occasional quiet fly-by of the
            // other flock members so the world still feels populated.
            if (Math.random() < 0.4) {
              const pick = otherFriends[Math.floor(Math.random() * otherFriends.length)];
              setCameo(pick);
              window.setTimeout(() => setCameo(null), 5_200);
              setPose("chirp");
              window.setTimeout(() => setPose("idle"), 700);
            }
          }
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [enabled, adultPresent, dragging, flying, dropFeather]);

  /* ====================== PERCH ON A PAGE LEDGE/CARD =======================
   * Every 30-60s Kiwi hops up onto the top edge of a real card on the page
   * (instead of free-floating) and does a little activity there. Skipped while
   * dragging/flying. (Branch landing + falling snacks were removed per Katy
   * 2026-06-17 — no more tree-branch world props.)
   */
  useEffect(() => {
    if (!enabled || adultPresent) return;
    let timer: number;
    const schedule = () => {
      const delay = 30_000 + Math.random() * 30_000;
      timer = window.setTimeout(() => {
        if (!dragging && !flying) {
          const ledges = findLedges();
          if (ledges.length) {
            const l = ledges[Math.floor(Math.random() * ledges.length)]!;
            // Stand on the card's top edge (sprite sits just above it).
            const target = { x: l.x - size / 2, y: l.y - size + 8 };
            setPose("flap");
            setPos(clamp(target, size, open));
            window.setTimeout(() => {
              // Start a little activity on the ledge.
              const act = KIWI_ACTIVITY_POSES[Math.floor(Math.random() * KIWI_ACTIVITY_POSES.length)]!;
              setPose(act);
              const msg = KIWI_ACTIVITY_BUBBLES[act];
              if (msg) {
                setBubbleText(msg);
                if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
                bubbleTimeoutRef.current = window.setTimeout(() => setBubbleText(null), 4000);
              }
              window.setTimeout(() => setPose("idle"), 7000 + Math.random() * 4000);
            }, 700);
          }
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [enabled, adultPresent, dragging, flying, size, open]);

  /* ===================== SLOW AMBIENT PROJECT (over time) ==================
   * Kiwi slowly works on a long project (nest, needlework, book tower) across
   * a session, advancing one stage every ~2-3 min with a quiet bubble.
   */
  useEffect(() => {
    if (!enabled || adultPresent) return;
    let timer: number;
    const schedule = () => {
      const delay = 120_000 + Math.random() * 60_000;
      timer = window.setTimeout(() => {
        if (!dragging && !flying) {
          setProjectTick((t) => {
            const next = t + 1;
            const proj = kiwiProjectForTick(projectKindRef.current, next);
            setBubbleText(proj.line);
            if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
            bubbleTimeoutRef.current = window.setTimeout(() => setBubbleText(null), 4500);
            // When a project finishes, pick a new one next time.
            if (next >= proj.totalStages - 1) {
              projectKindRef.current = ALL_PROJECT_KINDS[Math.floor(Math.random() * ALL_PROJECT_KINDS.length)]!;
              return 0;
            }
            return next;
          });
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [enabled, adultPresent, dragging, flying]);
  void projectTick;

  // React to user activity — flap briefly when mouse/touch moves
  useEffect(() => {
    if (!enabled || adultPresent) return;
    let cooldown = 0;
    const handler = () => {
      const now = Date.now();
      if (now - cooldown < 4000) return;
      cooldown = now;
      if (!dragging && !flying) {
        setPose("flap");
        window.setTimeout(() => setPose("idle"), 350);
      }
    };
    window.addEventListener("mousemove", handler, { passive: true });
    window.addEventListener("touchmove", handler, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handler);
      window.removeEventListener("touchmove", handler);
    };
  }, [enabled, adultPresent, dragging, flying]);

  // Celebrate event — visual only (sticker burst + flap pose). No sound, no auto-bubble.
  useEffect(() => {
    const onCelebrate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      void detail;
      setPose("flap");
      setPopBurst((n) => n + 1);
      // Also fire a visual-only emoji sticker burst from the perch. Silent.
      try {
        const perchEl =
          typeof document !== "undefined"
            ? document.querySelector("[data-kiwi-perch]")
            : null;
        if (perchEl) popStickersFromElement(perchEl, { count: 16 });
        else popStickersAt(window.innerWidth / 2, window.innerHeight * 0.45, { count: 14 });
      } catch { /* visual sugar only */ }
      lastInteractRef.current = Date.now();
      window.setTimeout(() => setPose("idle"), 1200);
    };
    window.addEventListener("kiwi:celebrate", onCelebrate as EventListener);
    return () => window.removeEventListener("kiwi:celebrate", onCelebrate as EventListener);
  }, []);

  // Pop burst when chat opens — visual only.
  useEffect(() => {
    if (open) setPopBurst((n) => n + 1);
  }, [open]);

  // Drag handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (adultPresent) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragOffsetRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    setDragging(true);
    setPose("flap");
  }, [pos.x, pos.y, adultPresent]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !dragOffsetRef.current) return;
    const { dx, dy } = dragOffsetRef.current;
    setPos(clamp({ x: e.clientX - dx, y: e.clientY - dy }, size, open));
  }, [dragging, size, open]);

  // Double-tap detection — second tap within 350ms triggers fly-across
  // instead of opening the chat.
  const lastTapAtRef = useRef<number>(0);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    dragOffsetRef.current = null;
    setPose("idle");
    const moved = Math.abs((e.clientX - (pos.x + 48))) + Math.abs((e.clientY - (pos.y + 48)));
    if (moved < 10) {
      const now = Date.now();
      const sinceLast = now - lastTapAtRef.current;
      lastTapAtRef.current = now;
      if (sinceLast > 0 && sinceLast < 350) {
        // Double-tap → friendly chirp (fly-across action retired per Katy).
        if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
        setPose("chirp");
        setBubbleText("Hi! 💛");
        setPopBurst((n) => n + 1);
        bubbleTimeoutRef.current = window.setTimeout(() => setBubbleText(null), 800);
        lastInteractRef.current = now;
        return;
      }
      // Direct tap on Kiwi — this IS the user click, so opening + bubble is fine.
      setPose("chirp");
      setBubbleText("Hi! 💛");
      setPopBurst((n) => n + 1);
      if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
      bubbleTimeoutRef.current = window.setTimeout(() => {
        setBubbleText(null);
        setPose("idle");
        setOpen(!open);
      }, 500);
    }
    lastInteractRef.current = Date.now();
  }, [dragging, open, setOpen, pos.x, pos.y]);

  if (!enabled) return null;

  const micActive = mode === "wake" && !adultPresent;

  return (
    <div
      data-kiwi-perch
      className="fixed z-30 no-print select-none"
      style={{
        left: pos.x,
        top: pos.y,
        transition: dragging
          ? "none"
          : flying
          ? "left 2.2s ease-in-out, top 2.2s ease-in-out"
          : "left 0.5s cubic-bezier(0.34,1.56,0.64,1), top 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        touchAction: "none",
        pointerEvents: "auto",
      }}
    >
      <div className="relative">
        {bubbleText && (
          <div
            style={{
              position: "absolute",
              bottom: size + 4,
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "'Patrick Hand','Comic Sans MS',cursive",
              fontSize: 13,
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              backgroundColor: "#fffbeb",
              color: "#1e293b",
              border: "2px solid #fbbf24",
              borderRadius: "1rem",
              padding: "6px 12px",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              maxWidth: 200,
              zIndex: 9999,
              pointerEvents: "none",
            }}
          >
            {bubbleText}
          </div>
        )}

        {popBurst > 0 && <PopBurst key={popBurst} size={size} />}

        {/* Drifting feathers that peel off on takeoff. Visual-only. */}
        {feathers.map((f, i) => (
          <Feather key={f.id} color={f.color} size={size} seed={f.id + i} />
        ))}

        {cameo && (() => {
          // The duck trio is a 3-wide image, so render it bigger and tuck it
          // lower-left like a little waddling squad; single birds sit close.
          const isDucks = cameo === "ducks";
          const cw = isDucks ? Math.round(size * 1.15) : Math.round(size * 0.65);
          return (
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                left: isDucks ? -Math.round(size * 0.7) : -Math.round(size * 0.55),
                top: isDucks ? Math.round(size * 0.35) : -Math.round(size * 0.15),
                width: cw,
                height: cw,
                animation: isDucks
                  ? "kiwiDucks 7.4s ease-in-out forwards"
                  : "kiwiCameo 6.6s ease-in-out forwards",
                filter: `drop-shadow(0 6px 10px ${getFlockMeta(cameo).accent}55)`,
              }}
              title={`${getFlockMeta(cameo).name} stopped by!`}
            >
              {isDucks ? (
                <div style={{ animation: "kiwiDuckWaddle 1.1s ease-in-out infinite" }}>
                  <FlockSprite member={cameo} size={cw} />
                </div>
              ) : (
                <FlockSprite member={cameo} size={cw} />
              )}
            </div>
          );
        })()}

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            cursor: dragging ? "grabbing" : "grab",
            width: size,
            height: size,
            transform: `${flying ? "rotate(-6deg) scale(1.05)" : dragging ? "scale(1.08)" : `rotate(${tilt}deg)`}`,
            transition: "transform 0.25s ease-out",
            filter: dragging ? "drop-shadow(0 8px 18px rgba(0,0,0,0.35))" : undefined,
          }}
          title="Drag Kiwi anywhere — tap to chat"
        >
          <KiwiSprite pose={pose} size={size} animate costume={costume} ariaLabel={`Kiwi the parakeet — ${dayChar.costumeLabel}. Drag me or tap to chat`} />
        </div>

        <div
          className="absolute -top-1 -right-1 rounded-full border border-white shadow"
          style={{
            width: 12,
            height: 12,
            background: micActive ? "#22c55e" : "#64748b",
            animation: micActive ? "kiwiMicPulse 1.8s ease-in-out infinite" : undefined,
          }}
          title={micActive ? 'Listening for "Hi Kiwi"' : "Wake word off"}
        />

        {/* Fly trigger removed (2026-06-18, per Katy) — the always-visible ✈️
            button was unnecessary clutter. Kiwi can still fly via double-tap
            (see the dblclick/double-tap handler above) and the window.flyKiwi
            hook, so no functionality is lost. */}
      </div>

      <style>{`
        @keyframes kiwiMicPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
          50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
        @keyframes kiwiPop {
          0% { transform: translate(0,0) scale(0.6); opacity: 0.9; }
          100% { transform: translate(var(--kx), var(--ky)) scale(1.1); opacity: 0; }
        }
        @keyframes kiwiCameo {
          0%   { transform: translate(20px, 10px) scale(0.4); opacity: 0; }
          15%  { transform: translate(0, 0) scale(1); opacity: 1; }
          70%  { transform: translate(-6px, -2px) scale(1); opacity: 1; }
          100% { transform: translate(-32px, -28px) scale(0.55); opacity: 0; }
        }
        @keyframes kiwiDucks {
          0%   { transform: translate(40px, 6px) scale(0.5); opacity: 0; }
          14%  { transform: translate(0, 0) scale(1); opacity: 1; }
          40%  { transform: translate(-6px, 0) scale(1); opacity: 1; }
          60%  { transform: translate(4px, 0) scale(1); opacity: 1; }
          80%  { transform: translate(-4px, 0) scale(1); opacity: 1; }
          100% { transform: translate(-44px, 4px) scale(0.6); opacity: 0; }
        }
        /* Inner waddle: a quick side-to-side + tiny vertical bob that reads like
           their real head-bobbing follow-the-leader walk. */
        @keyframes kiwiDuckWaddle {
          0%   { transform: translateY(0) rotate(0deg); }
          25%  { transform: translateY(-2px) rotate(-1.2deg); }
          50%  { transform: translateY(0) rotate(0deg); }
          75%  { transform: translateY(-2px) rotate(1.2deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes kiwiFeatherFall {
          0%   { transform: translate(0,0) rotate(0deg); opacity: 0.95; }
          100% { transform: translate(var(--fx), var(--fy)) rotate(var(--fr)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function PopBurst({ size = 80 }: { size?: number }) {
  const items = Array.from({ length: 6 }).map((_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    const r = 40 + Math.random() * 20;
    const kx = `${Math.cos(angle) * r}px`;
    const ky = `${Math.sin(angle) * r}px`;
    const glyph = i % 2 === 0 ? "🌿" : "💛";
    return (
      <span
        key={i}
        style={{
          position: "absolute",
          left: size / 2 - 8,
          top: size / 2 - 8,
          fontSize: 18,
          pointerEvents: "none",
          // @ts-expect-error CSS variables
          "--kx": kx,
          "--ky": ky,
          animation: "kiwiPop 900ms ease-out forwards",
        }}
      >
        {glyph}
      </span>
    );
  });
  return <>{items}</>;
}

/** A single drifting feather that peels off Kiwi on takeoff. Pure visual sugar. */
function Feather({ color, size, seed }: { color: string; size: number; seed: number }) {
  // Deterministic-ish drift from the seed so multiple feathers fan out.
  const dir = seed % 2 === 0 ? 1 : -1;
  const fx = `${dir * (24 + (seed % 5) * 9)}px`;
  const fy = `${48 + (seed % 4) * 14}px`;
  const fr = `${dir * (120 + (seed % 6) * 30)}deg`;
  const startLeft = size * 0.5 + dir * (size * 0.12);
  const startTop = size * 0.42;
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: startLeft,
        top: startTop,
        width: 14,
        height: 14,
        pointerEvents: "none",
        zIndex: 5,
        // @ts-expect-error CSS variables
        "--fx": fx,
        "--fy": fy,
        "--fr": fr,
        animation: "kiwiFeatherFall 3.4s ease-in forwards",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C8 6 5 11 5 16c0 3 2 6 7 6 0-5 1-9 4-13 1-2 1-5 0-7-1.5 1-3 3-4 7z"
          fill={color}
          stroke="rgba(0,0,0,0.12)"
          strokeWidth="0.6"
        />
        <path d="M9 19c1-4 2-8 5-12" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" fill="none" />
      </svg>
    </span>
  );
}

export function celebrateKiwi(message?: string) {
  window.dispatchEvent(new CustomEvent("kiwi:celebrate", { detail: { message } }));
}
