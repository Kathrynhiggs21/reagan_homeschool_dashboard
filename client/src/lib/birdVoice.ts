// birdVoice.ts — Kiwi speaks like a tween-girl-meets-parakeet.
//
// v2.87 (2026-05-21) — Mom asked for a faster, brighter, more child-bird voice
// AND for sliders to fine-tune it. The previous file exported a frozen
// `BIRD_VOICE_CONFIG` constant. We now:
//
// 1. Bumped defaults to feel chirpier and lighter:
//      rate   1.22  (a hair faster than 1.18)
//      pitch  1.95  (a hair brighter than 1.85 — squarely tween/parakeet)
//      volume 0.95
// 2. Read user-tuned overrides from localStorage on EVERY speak call so
//    Mom's slider changes take effect instantly without reloading.
// 3. Expose `getBirdVoiceConfig()` and `setBirdVoiceConfig(partial)` so the
//    new <KiwiVoiceSliders/> component (and tests) can drive it.
//
// `BIRD_VOICE_CONFIG` is kept exported (now as a const-snapshot of the
// defaults) for backwards compatibility with existing imports + tests.
//
// Exported surface (covered by vitest):
//   - BIRD_VOICE_DEFAULTS      : the slider midpoint / fall-back preset
//   - BIRD_VOICE_CONFIG        : alias of BIRD_VOICE_DEFAULTS (legacy)
//   - getBirdVoiceConfig()     : reads current effective config
//   - setBirdVoiceConfig(p)    : merges partial into stored slider values
//   - pickBirdVoice(voices)    : returns the best-matching SpeechSynthesisVoice
//   - chirp()                  : plays a 3-note chirp through WebAudio
//   - speakLikeBird(text)      : chirps once, then speaks the text with bird settings

export const BIRD_VOICE_DEFAULTS = {
  rate: 1.22,
  pitch: 1.95,
  volume: 0.95,
} as const;

/** @deprecated — use getBirdVoiceConfig() so user slider values flow through. */
export const BIRD_VOICE_CONFIG = BIRD_VOICE_DEFAULTS;

const LS_KEYS = {
  rate: "kiwiVoiceRate",
  pitch: "kiwiVoicePitch",
  volume: "kiwiVoiceVolume",
} as const;

function readNum(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage?.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  } catch {
    return fallback;
  }
}

export interface BirdVoiceConfig {
  rate: number;
  pitch: number;
  volume: number;
}

/** Read the current effective Kiwi voice config (defaults + slider overrides). */
export function getBirdVoiceConfig(): BirdVoiceConfig {
  return {
    rate:   readNum(LS_KEYS.rate,   BIRD_VOICE_DEFAULTS.rate,   0.7, 1.8),
    pitch:  readNum(LS_KEYS.pitch,  BIRD_VOICE_DEFAULTS.pitch,  0.6, 2.2),
    volume: readNum(LS_KEYS.volume, BIRD_VOICE_DEFAULTS.volume, 0,   1),
  };
}

/** Persist one or more slider values. Caller should rerender if it cares. */
export function setBirdVoiceConfig(partial: Partial<BirdVoiceConfig>): void {
  if (typeof window === "undefined") return;
  try {
    if (partial.rate   != null) window.localStorage?.setItem(LS_KEYS.rate,   String(partial.rate));
    if (partial.pitch  != null) window.localStorage?.setItem(LS_KEYS.pitch,  String(partial.pitch));
    if (partial.volume != null) window.localStorage?.setItem(LS_KEYS.volume, String(partial.volume));
  } catch { /* noop */ }
}

/**
 * Global silence gate. While true, chirp() and speakLikeBird() are hard no-ops.
 * Driven by `kiwiSilent` in localStorage. Defaults to "0" (audible) when the
 * key is missing, so first-time visitors hear Kiwi without needing to flip a
 * setting. Adults can still mute Kiwi from the Settings panel.
 */
function isSilenced(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage?.getItem("kiwiSilent");
    return v === "1";
  } catch {
    return false;
  }
}

/**
 * Rank a voice list to find the best "tween-girl-meets-bright-bird" voice.
 * Order matters — earlier patterns win. v2.87: pushed child/kid voices ahead
 * of the generic adult-female ones so the OS-default child voice (Edge,
 * iOS-13+, etc.) is preferred when present.
 */
export function pickBirdVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;
  const preferred = [
    /child|kid|girl|junior/i,           // explicit child voices first
    /jenny.*online/i,                   // Azure JennyMultilingual — bright tween-feel
    /aria.*online/i,                    // Azure Aria
    /google\s+(uk|us)\s+english.*female/i,
    /samantha/i,                        // macOS / iOS — clear, bright
    /aria/i,
    /jenny/i,
    /microsoft (zira|jenny|aria)/i,
    /karen/i,                           // AU female — bright
    /female/i,
  ];
  for (const rx of preferred) {
    const hit = voices.find((v) => rx.test(v.name));
    if (hit) return hit;
  }
  const anyEn = voices.find(
    (v) => v.lang?.startsWith("en") && !/male|daniel|alex|fred|kevin|david|mark|george/i.test(v.name),
  );
  return anyEn || voices[0];
}

let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC: typeof AudioContext | undefined =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new AC();
    } catch {
      return null;
    }
  }
  try {
    if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
  } catch { /* noop */ }
  return sharedCtx;
}

/** Play a 3-note parakeet-style chirp. Safe no-op if WebAudio unavailable
 *  or if the global silence gate is on. */
export function chirp() {
  if (isSilenced()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const notes = [
    { freq: 2400, start: 0,    dur: 0.08 },
    { freq: 3000, start: 0.07, dur: 0.08 },
    { freq: 2600, start: 0.15, dur: 0.10 },
  ];
  try {
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.start);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + n.start);
      gain.gain.exponentialRampToValueAtTime(
        0.32,
        ctx.currentTime + n.start + 0.012,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + n.start + n.dur,
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + n.start);
      osc.stop(ctx.currentTime + n.start + n.dur + 0.01);
    }
  } catch {
    // swallow — audio is a nice-to-have
  }
}

/** Internal: fall back to the browser's built-in speechSynthesis. */
function speakWithBrowser(text: string) {
  if (!("speechSynthesis" in window)) return;
  const cfg = getBirdVoiceConfig();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = cfg.rate;
  u.pitch = cfg.pitch;
  u.volume = cfg.volume;
  const choose = () => {
    const v = pickBirdVoice(speechSynthesis.getVoices());
    if (v) u.voice = v;
  };
  choose();
  if (!u.voice) {
    try {
      speechSynthesis.addEventListener("voiceschanged", choose, { once: true });
    } catch { /* noop */ }
  }
  try {
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* noop */ }
}

/** Module-level singleton so we don't stack overlapping clips. */
let currentKiwiAudio: HTMLAudioElement | null = null;

/**
 * Chirp once, then speak with Kiwi's neural Gemini voice via the existing
 * `kiwi.voice` mutation. Falls back to the browser's built-in speechSynthesis
 * only if (a) the network call hard-fails or (b) the adult has set
 * `kiwiCartoonVoice="0"` to opt out of neural TTS. Silenced when
 * `kiwiSilent === "1"`.
 */
export function speakLikeBird(text: string) {
  if (typeof window === "undefined") return;
  if (isSilenced()) return;
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  let useCartoon = true;
  try {
    const raw = window.localStorage?.getItem("kiwiCartoonVoice");
    if (raw !== null) useCartoon = raw === "1";
  } catch { /* noop */ }

  if (!useCartoon) {
    chirp();
    speakWithBrowser(trimmed);
    return;
  }

  const cfg = getBirdVoiceConfig();
  chirp();
  const body = JSON.stringify({
    json: { companionId: "kiwi", text: trimmed.slice(0, 800) },
  });
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
      try { currentKiwiAudio?.pause(); } catch { /* noop */ }
      const audio = new Audio(url);
      audio.volume = cfg.volume;
      // HTMLAudioElement doesn't have rate/pitch knobs that map cleanly to
      // Gemini-rendered speech, but we still apply playbackRate (which the
      // browser supports) so the slider has a perceivable effect on the
      // neural path too.
      try { audio.playbackRate = Math.max(0.5, Math.min(2, cfg.rate)); } catch { /* noop */ }
      currentKiwiAudio = audio;
      audio.onended = () => { URL.revokeObjectURL(url); };
      audio.onerror = () => { URL.revokeObjectURL(url); speakWithBrowser(trimmed); };
      audio.play().catch(() => speakWithBrowser(trimmed));
    })
    .catch(() => speakWithBrowser(trimmed));
}
