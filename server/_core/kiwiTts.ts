/**
 * Kiwi neural TTS — uses Gemini 3.1 Flash TTS to synthesize Kiwi's lines
 * with a real, natural-sounding tween-girl-meets-bird voice (default voice
 * is "Leda" — described "Youthful").
 *
 * Output is 24 kHz / 16-bit / mono PCM. We wrap it in a minimal WAV header
 * and upload to S3 storage so the browser can play it via a normal <audio>.
 *
 * Synthesized clips are cached by SHA-1(text + voice). Same line spoken
 * twice = one synthesis.
 */
import { GoogleGenAI } from "@google/genai";
import crypto from "node:crypto";
import { storagePut } from "../storage";

/** Available Kiwi voice presets (Gemini prebuilt voices, hand-picked). */
export const KIWI_VOICE_PRESETS = {
  Leda: "Youthful — bright tween girl (default)",
  Aoede: "Breezy — gentle, airy",
  Sadachbia: "Lively — peppy, energetic",
  Achird: "Friendly — warm and chatty",
  Erinome: "Clear — crisp diction",
} as const;
export type KiwiVoiceName = keyof typeof KIWI_VOICE_PRESETS;
export const DEFAULT_KIWI_VOICE: KiwiVoiceName = "Leda";

/** Style prefix that nudges the model into Kiwi's character. */
const STYLE_PREFIX =
  "Say in a bright, friendly tween-girl voice with the warmth of a small chirpy bird, " +
  "with a tiny upward chirp at the start: ";

/** Minimal WAV header for 24 kHz / 16-bit / mono PCM. */
function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

function cacheKey(text: string, voice: KiwiVoiceName): string {
  const hash = crypto
    .createHash("sha1")
    .update(`${voice}::${text}`)
    .digest("hex")
    .slice(0, 16);
  return `kiwi-tts/${voice.toLowerCase()}-${hash}.wav`;
}

/**
 * Synthesize Kiwi speech and return a public URL.
 *
 * Identical (text, voice) pairs hit the cached object in storage on second
 * call instead of re-synthesizing.
 */
export async function synthesizeKiwiSpeech(
  text: string,
  voice: KiwiVoiceName = DEFAULT_KIWI_VOICE,
): Promise<{ url: string; cached: boolean; voice: KiwiVoiceName }> {
  if (!text || !text.trim()) {
    throw new Error("synthesizeKiwiSpeech: text is required");
  }
  const trimmed = text.trim().slice(0, 600); // hard ceiling
  const key = cacheKey(trimmed, voice);

  // Probe cache first by attempting a HEAD on the public path.
  const publicUrl = `/manus-storage/${key}`;
  try {
    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) {
      return { url: publicUrl, cached: true, voice };
    }
  } catch {
    /* ignore — not a hard failure, fall through to synthesis */
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("synthesizeKiwiSpeech: GEMINI_API_KEY missing");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: STYLE_PREFIX + trimmed }] }],
    config: {
      responseModalities: ["AUDIO"] as any,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    } as any,
  });

  const part: any =
    response?.candidates?.[0]?.content?.parts?.[0] ?? null;
  const b64: string | undefined = part?.inlineData?.data;
  if (!b64) {
    throw new Error(
      `synthesizeKiwiSpeech: no audio returned (got ${JSON.stringify(part).slice(0, 200)})`,
    );
  }
  const pcm = Buffer.from(b64, "base64");
  const wav = pcmToWav(pcm, 24000);

  const stored = await storagePut(key, wav, "audio/wav");
  return { url: stored.url, cached: false, voice };
}
