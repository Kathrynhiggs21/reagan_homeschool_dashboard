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
  todayVisitKey,
  recordVisit,
  summarizeVisits,
  describeVisits,
  type VisitEntry,
  type VisitGuest,
  type VisitSummary,
} from "@shared/kiwiCharacter";
import { findLedges } from "@/lib/kiwiWorld";
import KiwiWardrobe, { readPersistedWardrobeLayers } from "./KiwiWardrobe";
import { pickOutfitOpinion, type GlyphLayer } from "@shared/kiwiWardrobe";
import { pickInterestChatter } from "@shared/interestEngine";
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
  // Reagan's #1 real interest (from the YouTube interest engine). Quiet/
  // null until real data exists, so Kiwi never invents an interest.
  const interestProfileQ = (trpc as any).interests?.profile?.useQuery?.(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  const topInterest: string | null =
    interestProfileQ?.data?.profile?.[0]?.label ?? null;

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

  // ---- Bird props (footprints / poop / pool / branch / store perches / food) ----
  // A prop spawns next to the active bird, plays its little bit, then auto-cleans
  // up. Visual-only; reduced-motion shows the prop statically (no splash/ripple).
  const [activeProp, setActiveProp] = useState<
    | { id: number; kind: string }
    | null
  >(null);
  const propIdRef = useRef(0);
  const propTimerRef = useRef<number | null>(null);
  const spawnProp = useCallback((kind: string, holdMs = 6000) => {
    const id = ++propIdRef.current;
    setActiveProp({ id, kind });
    if (propTimerRef.current) window.clearTimeout(propTimerRef.current);
    propTimerRef.current = window.setTimeout(() => {
      setActiveProp((p) => (p && p.id === id ? null : p));
    }, holdMs);
  }, []);

  // ---- Per-day visit log ("who came to see Kiwi today") ----
  // Reagan collects a tiny daily log of guest cameos. Persisted in localStorage
  // under a date-keyed key so it resets at local midnight on its own. Pure
  // helpers (todayVisitKey/recordVisit/summarizeVisits) live in kiwiCharacter.
  // Kiwi's Closet (dress-up wardrobe) open state + the outfit layers currently
  // worn on the live perch (loaded from localStorage, refreshed when the closet
  // saves/changes an outfit via the "kiwi-outfit-changed" window event).
  const [closetOpen, setCloset] = useState(false);
  const [wardrobeLayers, setWardrobeLayers] = useState<GlyphLayer[]>(() => readPersistedWardrobeLayers());
  useEffect(() => {
    const refresh = () => setWardrobeLayers(readPersistedWardrobeLayers());
    window.addEventListener("kiwi-outfit-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("kiwi-outfit-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  // Re-read the outfit each time the closet closes (covers same-tab edits).
  useEffect(() => {
    if (!closetOpen) setWardrobeLayers(readPersistedWardrobeLayers());
  }, [closetOpen]);

  const [visitKey, setVisitKey] = useState<string>(() => todayVisitKey());
  const [visitLog, setVisitLog] = useState<VisitEntry[]>([]);
  const [visitOpen, setVisitOpen] = useState(false);
  // Load (or roll over) the log whenever the active day-key changes.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(visitKey);
      const parsed = raw ? (JSON.parse(raw) as VisitEntry[]) : [];
      setVisitLog(Array.isArray(parsed) ? parsed : []);
    } catch {
      setVisitLog([]);
    }
  }, [visitKey]);
  // Record a guest visit into today's log (idempotent-safe; capped in helper).
  const recordTodayVisit = useCallback((guest: VisitGuest) => {
    const key = todayVisitKey();
    // If we've rolled past midnight since last write, switch keys first.
    setVisitKey((prev) => (prev === key ? prev : key));
    setVisitLog((prev) => {
      // When the key just rolled, prev still holds yesterday's rows; start fresh.
      const base = key === visitKey ? prev : [];
      const next = recordVisit(base, guest, Date.now());
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [visitKey]);
  const visitSummary: VisitSummary = useMemo(() => summarizeVisits(visitLog), [visitLog]);

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
          // ~25% of the time, if Kiwi is actually wearing something, she pipes
          // up about her current outfit (sassy, low-key, never nagging).
          const outfitLine = wardrobeLayers.length > 0 ? pickOutfitOpinion() : null;
          // ~18% of the time, if we know something Reagan keeps coming back to,
          // Kiwi name-drops it warmly (never school-pushy) — e.g. "saw you're
          // big on birds lately. respect." These come from her REAL interest
          // profile, so they stay empty/quiet until real data exists.
          const interestLine = topInterest && Math.random() < 0.18
            ? pickInterestChatter(topInterest)
            : null;
          const useOutfitLine = outfitLine && Math.random() < 0.25;
          const useInterestLine = !useOutfitLine && !!interestLine;
          const useMomentLine = !useOutfitLine && !useInterestLine && Math.random() < 0.45;
          const bubbleMsg = useOutfitLine
            ? outfitLine
            : useInterestLine
            ? interestLine
            : useMomentLine
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
  }, [enabled, adultPresent, dragging, flying, moment, wardrobeLayers, topInterest]);

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
            // Log it into Reagan's per-day "who visited today" collectible.
            recordTodayVisit(soc.guestId === "ducks" ? "ducks" : "lychee");
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
            } else if (soc.beat === "synchop") {
              // Synchronized hop with Lychee — Kiwi hops happily too.
              setPose("flap");
              window.setTimeout(() => setPose("chirp"), 300);
              window.setTimeout(() => setPose("idle"), 900);
            } else {
              setPose("chirp");
              window.setTimeout(() => setPose("idle"), 700);
            }
            // Beat-specific props that auto-clean-up alongside the cameo.
            const hold = soc.guestId === "ducks" ? 7_600 : 6_800;
            if (soc.beat === "poolsplash") spawnProp("pool", hold);
            else if (soc.beat === "huddle") spawnProp("huddle", hold);
            else if (soc.beat === "sharedberry") spawnProp("berry", hold);
            // Clear the cameo after the hold (ducks linger a touch longer).
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
  }, [enabled, adultPresent, dragging, flying, dropFeather, spawnProp, recordTodayVisit]);

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

        {/* Drifting feathers removed per Katy — "just Kiwi." */}
        {false && feathers.map((f, i) => (
          <Feather key={f.id} color={f.color} size={size} seed={f.id + i} />
        ))}

        {/* Bird props (suitcase / pool / berry / huddle) removed per Katy —
            "just Kiwi." The spawnProp machinery stays intact but nothing is
            rendered so she never carries clutter. */}
        {false && activeProp && (
          <BirdProp
            key={activeProp.id}
            kind={activeProp.kind}
            size={size}
            reduced={reducedMotion}
          />
        )}

        {/* Flock cameos (Lychee / duck squad flying in) removed per Katy —
            "just Kiwi." Guarded off so no other birds appear. */}
        {false && cameo && (() => {
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
          {/* Plain animated Kiwi — no daily costume, no dress-up wardrobe
              layers (per Katy: "just Kiwi, still animated"). The sprite still
              breathes / blinks / changes pose on its own. */}
          <KiwiSprite pose={pose} size={size} animate costume="none" wardrobeLayers={[]} ariaLabel="Kiwi the parakeet — drag me or tap to chat" />
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

        {/* Dress-up tab removed per Katy — "just Kiwi." (The KiwiWardrobe
            dialog + machinery stay in the tree but there's no launcher on the
            perch, so Kiwi stays plain.) */}

        {/* Per-day "who visited today" collectible badge. Only appears once a
            guest has actually stopped by (standing rule: don't show if no info).
            Tappable → popover listing today's visitors + times. */}
        {/* Visit badge removed per Katy — "just Kiwi" (no chips under the perch). */}
        {false && visitSummary.total > 0 && (
          <VisitBadge
            summary={visitSummary}
            log={visitLog}
            open={visitOpen}
            onToggle={() => setVisitOpen((v) => !v)}
            size={size}
          />
        )}
      </div>

      {/* Kiwi's Closet dress-up dialog. Refreshes the perch outfit on close. */}
      <KiwiWardrobe open={closetOpen} onOpenChange={setCloset} />

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
        /* Prop fade-in for pool / huddle / berry accents. */
        @keyframes kiwiPropIn {
          0%   { transform: translateY(8px) scale(0.7); opacity: 0; }
          16%  { transform: translateY(0) scale(1); opacity: 1; }
          84%  { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(4px) scale(0.85); opacity: 0; }
        }
        /* Expanding water ripple rings under the splashing ducks. */
        @keyframes kiwiRipple {
          0%   { transform: scale(0.3); opacity: 0.55; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        /* Splash droplets arcing up off the pool. */
        @keyframes kiwiDroplet {
          0%   { transform: translate(0,0) scale(1); opacity: 0.9; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/**
 * VisitBadge — Reagan's per-day "who came to see Kiwi today" collectible.
 * A little chip tucked under the perch showing a guest icon per unique visitor
 * (plus a count). Tapping it opens a tiny popover that lists each visit time.
 * Visual + informational only; never makes sound.
 */
function VisitBadge({
  summary,
  log,
  open,
  onToggle,
  size,
}: {
  summary: VisitSummary;
  log: VisitEntry[];
  open: boolean;
  onToggle: () => void;
  size: number;
}) {
  const guestIcon = (g: VisitGuest) => (g === "lychee" ? "🦜" : "🦆");
  const guestName = (g: VisitGuest) => (g === "lychee" ? "Lychee" : "Duck squad");
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div
      className="absolute"
      style={{ top: size + 6, left: "50%", transform: "translateX(-50%)", zIndex: 40 }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Today's visitors: ${describeVisits(summary)}`}
        title="Who visited Kiwi today?"
        className="flex items-center gap-1 rounded-full border-2 border-amber-300 bg-amber-50 px-2 py-0.5 shadow hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-amber-400"
        style={{ fontFamily: "'Patrick Hand','Comic Sans MS',cursive" }}
        data-testid="kiwi-visit-badge"
      >
        {summary.guests.map((g) => (
          <span key={g} aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
            {guestIcon(g)}
          </span>
        ))}
        <span className="text-[11px] font-bold text-amber-800">{summary.total}</span>
      </button>
      {open && (
        <div
          className="absolute left-1/2 -translate-x-1/2 mt-1 rounded-xl border-2 border-amber-300 bg-white p-2 shadow-lg"
          style={{ width: 178, zIndex: 9999, fontFamily: "'Patrick Hand','Comic Sans MS',cursive" }}
          data-testid="kiwi-visit-popover"
        >
          <div className="text-[12px] font-bold text-amber-800 mb-1">Visitors today 🎉</div>
          <div className="max-h-40 overflow-auto">
            {[...log]
              .slice()
              .reverse()
              .map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[12px] text-slate-700 py-0.5">
                  <span aria-hidden>{guestIcon(e.guest)}</span>
                  <span className="font-semibold">{guestName(e.guest)}</span>
                  <span className="ml-auto text-[11px] text-slate-400">{fmtTime(e.ts)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
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

/**
 * A little world prop that appears next to the active bird for a beat, then
 * auto-cleans up. Visual-only sugar. With reduced motion the prop is shown
 * statically (no splash droplets / ripple animation).
 */
function BirdProp({ kind, size, reduced }: { kind: string; size: number; reduced: boolean }) {
  // Tuck the prop lower-left, roughly where the cameo squad waddles in.
  const base: React.CSSProperties = {
    position: "absolute",
    left: -Math.round(size * 0.55),
    top: Math.round(size * 0.55),
    pointerEvents: "none",
    animation: reduced ? undefined : "kiwiPropIn 7s ease-in-out forwards",
  };

  if (kind === "pool") {
    const pw = Math.round(size * 1.1);
    const ph = Math.round(pw * 0.4);
    // A few droplets arcing up off the water.
    const drops = Array.from({ length: 5 }).map((_, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      const dx = `${dir * (10 + i * 6)}px`;
      const dy = `${-(16 + (i % 3) * 8)}px`;
      return (
        <span
          key={i}
          style={{
            position: "absolute",
            left: pw / 2,
            top: ph * 0.35,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "rgba(125,211,252,0.95)",
            // @ts-expect-error CSS variables
            "--dx": dx,
            "--dy": dy,
            animation: reduced ? undefined : `kiwiDroplet ${900 + i * 120}ms ease-out ${i * 160}ms infinite`,
          }}
        />
      );
    });
    return (
      <div aria-hidden style={{ ...base, width: pw, height: ph }} title="Pool day!">
        {/* Ripple rings */}
        {!reduced && [0, 1].map((r) => (
          <span
            key={r}
            style={{
              position: "absolute",
              left: pw * 0.2,
              top: ph * 0.3,
              width: pw * 0.6,
              height: ph * 0.5,
              border: "2px solid rgba(56,189,248,0.5)",
              borderRadius: "50%",
              animation: `kiwiRipple ${1800}ms ease-out ${r * 700}ms infinite`,
            }}
          />
        ))}
        {/* The pool basin */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            width: pw,
            height: ph,
            borderRadius: "50%",
            background: "radial-gradient(ellipse at 50% 38%, #7dd3fc 0%, #38bdf8 55%, #0ea5e9 100%)",
            boxShadow: "inset 0 3px 6px rgba(255,255,255,0.45), 0 3px 6px rgba(2,132,199,0.35)",
            border: "3px solid #1d4ed8",
          }}
        />
        {drops}
      </div>
    );
  }

  if (kind === "huddle") {
    // A cozy little warmth glow + zzz for the cold-day cuddle pile.
    return (
      <div aria-hidden style={{ ...base, width: Math.round(size * 0.7), height: Math.round(size * 0.5) }} title="Cozy huddle">
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 60%, rgba(251,191,36,0.35) 0%, rgba(251,191,36,0) 70%)",
            filter: "blur(2px)",
          }}
        />
        <span style={{ position: "absolute", left: "60%", top: 0, fontSize: 14, opacity: 0.8 }}>💤</span>
      </div>
    );
  }

  if (kind === "berry") {
    // A shared little berry between Kiwi + Lychee.
    return (
      <div aria-hidden style={{ ...base, width: 22, height: 22, left: -Math.round(size * 0.2), top: Math.round(size * 0.25) }} title="Sharing a berry">
        <span style={{ fontSize: 18 }}>🫐</span>
      </div>
    );
  }

  return null;
}
