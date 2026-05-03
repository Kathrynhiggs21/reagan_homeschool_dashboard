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
    rate: 1.05,
    pitch: 1.6,
    volume: 0.9,
    preferred: [/samantha/i, /aria/i, /jenny/i, /google us english/i, /karen/i, /zira/i, /female/i],
    blurb: "Bright & cheery",
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

/**
 * Speak `text` as the given companion. Honors the global silence gate. Falls
 * back to a no-op outside a browser or without speechSynthesis support.
 */
export function speakAs(id: CompanionId | string | undefined | null, text: string) {
  if (typeof window === "undefined") return;
  if (isSilenced()) return;
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
