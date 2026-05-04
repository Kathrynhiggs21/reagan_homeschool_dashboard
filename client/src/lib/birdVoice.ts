// birdVoice.ts — Kiwi speaks like a tween-girl-meets-parakeet.
//
// May 4 fix: Kiwi was silent for most adults because the silence gate
// defaulted to ON whenever localStorage.kiwiSilent was missing. Now the
// gate defaults to OFF (only silent when the adult explicitly mutes her).
//
// Voice tuning bumped to feel chirpy and bright:
//   - rate  1.18  (slightly fast, peppy)
//   - pitch 1.85  (high but still intelligible — tween-girl range)
//   - volume 0.95
//
// Exported surface (covered by vitest):
//   - BIRD_VOICE_CONFIG    : pitch/rate/volume preset
//   - pickBirdVoice(voices): returns the best-matching SpeechSynthesisVoice
//   - chirp()              : plays a 3-note chirp through WebAudio
//   - speakLikeBird(text)  : chirps once, then speaks the text with bird settings

export const BIRD_VOICE_CONFIG = {
  rate: 1.18,
  pitch: 1.85,
  volume: 0.95,
} as const;

/**
 * Global silence gate. While true, chirp() and speakLikeBird() are hard no-ops
 * — no WebAudio chirp and no SpeechSynthesis speech.
 *
 * Driven by `kiwiSilent` in localStorage. Defaults to "0" (audible) when the
 * key is missing, so first-time visitors hear Kiwi without needing to flip a
 * setting. Adults can still mute Kiwi from the Settings panel.
 */
function isSilenced(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage?.getItem("kiwiSilent");
    // Default to AUDIBLE ("0") when the key is missing.
    return v === "1";
  } catch {
    return false;
  }
}

/**
 * Rank a voice list to find the best "tween-girl-meets-bright-bird" voice.
 * Order matters — earlier patterns win.
 */
export function pickBirdVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;

  // Strong preference for voices that sound small/bright/female.
  // Cloud / premium voices first (they have natural intonation), then the
  // built-in OS voices that are reliably bright.
  const preferred = [
    /child|kid|girl/i,                 // Edge / cloud "child" voices when present
    /jenny.*online/i,                  // Azure JennyMultilingual — bright tween-feel
    /aria.*online/i,                   // Azure Aria
    /google\s+(uk|us)\s+english.*female/i,
    /samantha/i,                       // macOS / iOS — clear, bright
    /aria/i,
    /jenny/i,
    /microsoft (zira|jenny|aria)/i,
    /karen/i,                          // AU female — bright
    /female/i,
  ];
  for (const rx of preferred) {
    const hit = voices.find((v) => rx.test(v.name));
    if (hit) return hit;
  }
  // Fall back to any English voice, but skip obvious male/deep options.
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
  // Some browsers (Chrome, Safari) suspend the context until a user gesture.
  // Try to resume on each call so the first chirp after a gesture actually plays.
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
  // Three quick notes — slightly higher than before so it reads "tween bird".
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
  const u = new SpeechSynthesisUtterance(text);
  u.rate = BIRD_VOICE_CONFIG.rate;
  u.pitch = BIRD_VOICE_CONFIG.pitch;
  u.volume = BIRD_VOICE_CONFIG.volume;
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

/** Read the user-selected Kiwi voice preset from localStorage. */
function readVoicePref(): string {
  try {
    return window.localStorage?.getItem("kiwiVoice") ?? "Leda";
  } catch {
    return "Leda";
  }
}

/** Try to play an audio URL; resolves to true on success. */
function playAudio(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const a = new Audio(url);
      a.volume = BIRD_VOICE_CONFIG.volume;
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false);
      a.play().then(
        () => { /* ended will fire later */ },
        () => resolve(false),
      );
    } catch {
      resolve(false);
    }
  });
}

/** Module-level singleton so we don't stack overlapping clips. */
let currentKiwiAudio: HTMLAudioElement | null = null;

/**
 * Chirp once, then speak with Kiwi's neural Gemini voice via the existing
 * `kiwi.voice` mutation (the same pipeline Blue/Daffy/Honk use).
 *
 * Falls back to the browser's built-in speechSynthesis only if (a) the
 * network call hard-fails or (b) the adult has set `kiwiCartoonVoice="0"`
 * to opt out of neural TTS. Silenced when `kiwiSilent === "1"`.
 */
export function speakLikeBird(text: string) {
  if (typeof window === "undefined") return;
  if (isSilenced()) return;
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  // Check the cartoon-voice opt-out (default ON).
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

  // Neural path — chirp first as a tiny attention grabber, then play the
  // Gemini-rendered Kiwi voice.
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
      audio.volume = BIRD_VOICE_CONFIG.volume;
      currentKiwiAudio = audio;
      audio.onended = () => { URL.revokeObjectURL(url); };
      audio.onerror = () => { URL.revokeObjectURL(url); speakWithBrowser(trimmed); };
      audio.play().catch(() => speakWithBrowser(trimmed));
    })
    .catch(() => speakWithBrowser(trimmed));
}
