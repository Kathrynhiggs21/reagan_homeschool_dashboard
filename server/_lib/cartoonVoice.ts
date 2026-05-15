/**
 * Cartoon-voice TTS for Kiwi & friends — Phase 14.
 *
 * Uses Gemini 2.5 Flash TTS (single-speaker, prebuilt voice) which returns
 * raw PCM @ 24kHz. We wrap that in a minimal WAV header so any browser audio
 * element can play it directly.
 *
 * Per-character config:
 *   * kiwi  — bright/female-leaning, fast, with a parakeet-style style hint
 *   * blue  — calm sidekick, similar tone
 *   * daffy — duckling, fast and high
 *   * honk  — gosling, lower and louder
 *
 * The character's `style` is prefixed onto the text as a Gemini "say it
 * like X:" hint, which materially changes the prosody without us having
 * to ship per-voice fine-tuning.
 *
 * Public surface:
 *   - CARTOON_VOICES         : per-companion config map
 *   - synthesizeCartoonVoice : returns { mime, data: Buffer } WAV bytes
 */
export type CartoonVoiceId = "kiwi" | "blue" | "daffy" | "honk";

export interface CartoonVoiceConfig {
  /** Gemini prebuilt voice name. */
  voiceName: string;
  /** Style hint we prefix to the text. */
  style: string;
}

export const CARTOON_VOICES: Record<CartoonVoiceId, CartoonVoiceConfig> = {
  kiwi: {
    // May 15, 2026 retune — Reagan feedback (age 11): the previous voice
    // (7-year-old buddy) read as creepy and kiddy to her. New target: a
    // calm older-cousin voice, like a thoughtful 14- or 15-year-old talking
    // to her at the kitchen table. Plain, steady, never chirpy. No giggles,
    // no cartoon-bird sparkle, no cute affectations. Keeping the Leda voice
    // because it's the most natural-sounding young Gemini prebuilt, and the
    // style hint pulls the prosody down and slower.
    voiceName: "Leda",
    style:
      "Voice: a calm, plain older-cousin voice, like a thoughtful 14-year-old talking to an 11-year-old at the kitchen table. NOT high-pitched. NOT chirpy. NOT cutesy. No giggles. No baby talk. No cartoon-bird sparkle. Pitch sits at neutral or slightly below — the lowest the voice can comfortably go. Cadence is unhurried and steady, with short natural pauses between sentences. Tone is matter-of-fact and kind, like reading aloud to a younger sibling who's had a long day. Read each sentence as a complete unit; don't rush.",
  },
  blue: {
    voiceName: "Aoede",
    style: "Calm sidekick parakeet — a touch deeper and slower than Kiwi, warm and steady.",
  },
  daffy: {
    voiceName: "Puck",
    style: "Goofy fast duckling — high pitched and a little silly, but always kind.",
  },
  honk: {
    voiceName: "Charon",
    style: "Big friendly gosling — lower and louder, like a gentle older sibling.",
  },
};

/** Build the minimal RIFF/WAVE header for raw 16-bit PCM. */
function wavHeader(sampleRate: number, dataLength: number, channels = 1): Buffer {
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const buf = Buffer.alloc(44);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLength, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);          // PCM chunk size
  buf.writeUInt16LE(1, 20);           // audio format (1 = PCM)
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);          // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataLength, 40);
  return buf;
}

/**
 * Pull `rate=N` from a Gemini PCM mime like "audio/L16;codec=pcm;rate=24000".
 * Defaults to 24000 (Gemini's documented default).
 */
export function parseSampleRate(mime: string | undefined): number {
  if (!mime) return 24000;
  const m = /rate\s*=\s*(\d+)/i.exec(mime);
  if (!m) return 24000;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 24000;
}

export function pcmToWav(pcm: Buffer, mime?: string): Buffer {
  const rate = parseSampleRate(mime);
  return Buffer.concat([wavHeader(rate, pcm.length, 1), pcm]);
}

/** Pure: assemble the request body Gemini expects. Exported for tests. */
export function buildGeminiTtsBody(id: CartoonVoiceId, text: string): unknown {
  const cfg = CARTOON_VOICES[id] ?? CARTOON_VOICES.kiwi;
  const safeText = String(text || "").slice(0, 800).trim();
  const styled = `${cfg.style}\nSay this in that voice: ${safeText}`;
  return {
    contents: [{ parts: [{ text: styled }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voiceName } },
      },
    },
  };
}

/** Talk to the Gemini TTS endpoint and return WAV bytes. */
export async function synthesizeCartoonVoice(
  id: CartoonVoiceId,
  text: string,
): Promise<{ mime: string; data: Buffer }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const body = buildGeminiTtsBody(id, text);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Gemini TTS ${r.status}: ${errText.slice(0, 200)}`);
  }
  const json: any = await r.json();
  const part = json?.candidates?.[0]?.content?.parts?.find?.((p: any) => p?.inlineData?.data);
  const data: string | undefined = part?.inlineData?.data;
  const mime: string | undefined = part?.inlineData?.mimeType;
  if (!data) throw new Error("Gemini TTS returned no audio data");
  const pcm = Buffer.from(data, "base64");
  return { mime: "audio/wav", data: pcmToWav(pcm, mime) };
}
