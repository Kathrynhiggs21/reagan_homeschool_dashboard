// companionVoices.ts — per-character voice config for Kiwi & Friends.
//
// The flock roster matches FlockSprite.FLOCK_MEMBERS:
//   - kiwi  : green parakeet, bright/female-leaning (Reagan's main companion)
//   - blue  : blue parakeet, similar to Kiwi but a touch deeper
//   - daffy : duckling, fast and high-pitched, slightly silly
//   - honk  : gosling, lower and louder than the others
//
// Public surface (covered by vitest):
//   - COMPANION_IDS                : readonly tuple of valid ids
//   - COMPANION_VOICES             : record of id -> config
//   - getCompanionConfig(id)       : safe lookup with fallback to "kiwi"
//   - pickVoiceForCompanion(id, vs): returns best voice for that companion
//   - speakAs(id, text)            : same gate as speakLikeBird, uses companion voice

import { pickBirdVoice } from "./birdVoice";

export const COMPANION_IDS = ["kiwi", "blue", "daffy", "honk"] as const;

export type CompanionId = (typeof COMPANION_IDS)[number];

export interface CompanionVoiceConfig {
  rate: number;     // 0.1 .. 10
  pitch: number;    // 0 .. 2
  volume: number;   // 0 .. 1
  /** Ranked list of voice-name regexes to prefer. */
  preferred: RegExp[];
  /** Short tag for UI hints (e.g. "Bright & cheery"). */
  blurb: string;
}

export const COMPANION_VOICES: Record<CompanionId, CompanionVoiceConfig> = {
  kiwi: {
    // Cuter Kiwi (May 2026 tune): higher pitch, gentler pace, smaller-sounding,
    // and prefer kid/young/sweet voices first so the OS fallback also reads cute.
    rate: 0.98,
    pitch: 1.95,
    volume: 0.85,
    preferred: [
      /child|kid|junior|young/i,
      /jenny/i,
      /aria/i,
      /samantha/i,
      /google us english/i,
      /karen/i,
      /zira/i,
      /female/i,
    ],
    blurb: "Tiny & sweet",
  },
  blue: {
    rate: 1.0,
    pitch: 1.4,
    volume: 0.9,
    preferred: [/aria/i, /karen/i, /serena/i, /tessa/i, /female/i, /samantha/i],
    blurb: "Calm sidekick",
  },
  daffy: {
    rate: 1.2,
    pitch: 1.85,
    volume: 0.85,
    preferred: [/child|kid/i, /microsoft mark/i, /aria/i, /tessa/i, /female/i],
    blurb: "Goofy & fast",
  },
  honk: {
    rate: 0.95,
    pitch: 0.9,
    volume: 1.0,
    preferred: [/daniel/i, /alex/i, /george/i, /microsoft david/i, /fred/i, /male/i],
    blurb: "Big & friendly",
  },
};

export function getCompanionConfig(id: string | undefined | null): CompanionVoiceConfig {
  if (!id) return COMPANION_VOICES.kiwi;
  const norm = String(id).toLowerCase();
  return (COMPANION_VOICES as any)[norm] ?? COMPANION_VOICES.kiwi;
}

/** Pick the best matching voice for a given companion from the available list. */
export function pickVoiceForCompanion(
  id: string | undefined | null,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;
  const cfg = getCompanionConfig(id);
  for (const rx of cfg.preferred) {
    const hit = voices.find((v) => rx.test(v.name));
    if (hit) return hit;
  }
  // Final fallback — Kiwi-style "small bright bird".
  return pickBirdVoice(voices);
}

/** Shared silence gate (mirrors birdVoice.ts to keep the two in sync). */
function isSilenced(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage?.getItem("kiwiSilent");
    return v === null || v === "1";
  } catch {
    return true;
  }
}

/** Local fallback: speak via the browser's built-in speechSynthesis. */
function speakLocal(id: CompanionId | string | undefined | null, text: string) {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  const cfg = getCompanionConfig(id);
  const u = new SpeechSynthesisUtterance(text);
  u.rate = cfg.rate;
  u.pitch = cfg.pitch;
  u.volume = cfg.volume;
  const v = pickVoiceForCompanion(id, speechSynthesis.getVoices());
  if (v) u.voice = v;
  try {
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

/** Module-level singleton so we can stop the previous cartoon clip. */
let currentCartoonAudio: HTMLAudioElement | null = null;

/**
 * Speak `text` as the given companion.
 *
 * Phase 14: when `kiwiCartoonVoice === "1"` (Mom-toggled in Settings) we
 * fetch a high-fidelity cartoon WAV from the server and play that instead
 * of the OS speechSynthesis voice. We always fall back gracefully so
 * silence is the worst-case behavior, never a crash.
 */
export function speakAs(id: CompanionId | string | undefined | null, text: string) {
  if (typeof window === "undefined") return;
  if (isSilenced()) return;
  let useCartoon = false;
  try { useCartoon = window.localStorage?.getItem("kiwiCartoonVoice") === "1"; } catch { /* no-op */ }
  if (!useCartoon) { speakLocal(id, text); return; }
  // tRPC fetch via plain fetch so we don't have to weave a hook in here.
  const trimmed = String(text || "").slice(0, 800);
  if (!trimmed) return;
  const companionId = (typeof id === "string" && ["kiwi", "blue", "daffy", "honk"].includes(id))
    ? id : "kiwi";
  const body = JSON.stringify({ json: { companionId, text: trimmed } });
  fetch("/api/trpc/kiwi.voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body,
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const data = j?.result?.data?.json ?? j?.result?.data;
      const b64: string | undefined = data?.audioBase64;
      const mime: string = data?.mime || "audio/wav";
      if (!b64) throw new Error("no audio");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      try { currentCartoonAudio?.pause(); } catch { /* no-op */ }
      const audio = new Audio(url);
      currentCartoonAudio = audio;
      audio.onended = () => { URL.revokeObjectURL(url); };
      audio.onerror = () => { URL.revokeObjectURL(url); speakLocal(id, text); };
      audio.play().catch(() => speakLocal(id, text));
    })
    .catch(() => speakLocal(id, text));
}

/** Helper: returns the active companion id from localStorage, defaulting to "kiwi". */
export function getActiveCompanionId(): CompanionId {
  if (typeof window === "undefined") return "kiwi";
  try {
    const raw = window.localStorage?.getItem("activeCompanion");
    if (raw && (COMPANION_IDS as readonly string[]).includes(raw)) {
      return raw as CompanionId;
    }
  } catch {
    // ignore
  }
  return "kiwi";
}

/** Helper: persists the active companion id. */
export function setActiveCompanionId(id: CompanionId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem("activeCompanion", id);
    // Notify listeners (companion belt + chat banner) on change.
    window.dispatchEvent(new CustomEvent("kiwi:active-companion-changed", { detail: { id } }));
  } catch {
    // ignore
  }
}
