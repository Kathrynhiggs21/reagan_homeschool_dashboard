// birdVoice.ts — Kiwi speaks more like a parakeet than a person.
// Pairs a short WebAudio chirp (3 quick notes) with a higher-pitched,
// faster SpeechSynthesis utterance.
//
// Exported surface (also covered by vitest):
//   - BIRD_VOICE_CONFIG    : pitch/rate/volume preset
//   - pickBirdVoice(voices): returns the best-matching SpeechSynthesisVoice
//   - chirp()              : plays a 3-note chirp through WebAudio
//   - speakLikeBird(text)  : chirps once, then speaks the text with bird settings

export const BIRD_VOICE_CONFIG = {
  rate: 1.05,
  pitch: 1.6,
  volume: 0.9,
} as const;

/**
 * Global silence gate. While true, chirp() and speakLikeBird() are hard no-ops
 * — no WebAudio chirp and no SpeechSynthesis speech. This is driven by the
 * `kiwiSilent` localStorage flag, which defaults to "1" (silent) until the user
 * explicitly un-mutes Kiwi in Settings.
 */
function isSilenced(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage?.getItem("kiwiSilent");
    // Default to silent ("1") when the key is missing.
    return v === null || v === "1";
  } catch {
    return true;
  }
}

/** Rank a voice list to find the best "small bright bird" voice available. */
export function pickBirdVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;

  // Strong preference for voices that sound small/bright/female; avoid male/deep.
  const preferred = [
    /samantha/i,
    /aria/i,
    /jenny/i,
    /google us english/i,
    /karen/i,
    /zira/i,
    /child|kid/i,
    /female/i,
  ];
  for (const rx of preferred) {
    const hit = voices.find((v) => rx.test(v.name));
    if (hit) return hit;
  }
  // Fall back to any English voice, but skip obvious male/deep options.
  const anyEn = voices.find(
    (v) => v.lang?.startsWith("en") && !/male|daniel|alex|fred|kevin/i.test(v.name),
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
  return sharedCtx;
}

/** Play a 3-note parakeet-style chirp. Safe no-op if WebAudio unavailable
 *  or if the global silence gate is on. */
export function chirp() {
  if (isSilenced()) return;
  const ctx = getCtx();
  if (!ctx) return;
  // Three ascending-then-descending notes, each ~80-120ms, with fast envelope.
  const notes = [
    { freq: 2200, start: 0, dur: 0.09 },
    { freq: 2800, start: 0.08, dur: 0.09 },
    { freq: 2400, start: 0.17, dur: 0.11 },
  ];
  try {
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.start);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + n.start);
      gain.gain.exponentialRampToValueAtTime(
        0.35,
        ctx.currentTime + n.start + 0.015,
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

/** Chirp once, then speak with bird-voice TTS settings.
 *  When the global silence gate is on, this is a full no-op. */
export function speakLikeBird(text: string) {
  if (typeof window === "undefined") return;
  if (isSilenced()) return;
  if (!("speechSynthesis" in window)) return;
  chirp();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = BIRD_VOICE_CONFIG.rate;
  u.pitch = BIRD_VOICE_CONFIG.pitch;
  u.volume = BIRD_VOICE_CONFIG.volume;
  const v = pickBirdVoice(speechSynthesis.getVoices());
  if (v) u.voice = v;
  try {
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}
