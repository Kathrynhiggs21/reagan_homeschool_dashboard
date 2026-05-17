import { describe, it, expect } from "vitest";
import {
  CARTOON_VOICES,
  buildGeminiTtsBody,
  parseSampleRate,
  pcmToWav,
} from "./_lib/cartoonVoice";

describe("Phase 14 — cartoonVoice", () => {
  it("exposes all four companion voice configs", () => {
    for (const id of ["kiwi", "blue", "daffy", "honk"] as const) {
      expect(CARTOON_VOICES[id].voiceName).toBeTruthy();
      expect(CARTOON_VOICES[id].style.length).toBeGreaterThan(10);
    }
  });

  it("buildGeminiTtsBody embeds style + uses prebuilt voice", () => {
    // v2.20 (2026-05-17): The Kiwi voice prompt was rewritten away
    // from the original "real-kid" wording (Phase 14) to a calmer
    // "older-cousin" framing (no baby talk, no cartoon-bird sparkle).
    // The contract that mattered — the kiwi style is embedded into
    // the request body and the supplied utterance is appended —
    // is unchanged. Pin the assertion to the new style key phrase.
    const body: any = buildGeminiTtsBody("kiwi", "Hi Reagan, ready for math?");
    const text = body.contents[0].parts[0].text;
    expect(text).toContain("older-cousin");
    expect(text).toContain("Hi Reagan");
    expect(body.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName)
      .toBe(CARTOON_VOICES.kiwi.voiceName);
  });

  it("buildGeminiTtsBody clamps text to 800 chars", () => {
    const body: any = buildGeminiTtsBody("blue", "x".repeat(2000));
    const text = body.contents[0].parts[0].text;
    expect(text.length).toBeLessThanOrEqual(950); // style prefix + 800 char body
  });

  it("parseSampleRate handles Gemini PCM mime + falls back to 24kHz", () => {
    expect(parseSampleRate("audio/L16;codec=pcm;rate=24000")).toBe(24000);
    expect(parseSampleRate("audio/L16;codec=pcm;rate=16000")).toBe(16000);
    expect(parseSampleRate(undefined)).toBe(24000);
    expect(parseSampleRate("garbage")).toBe(24000);
  });

  it("pcmToWav writes a valid RIFF/WAVE header", () => {
    const pcm = Buffer.alloc(100, 0x01);
    const wav = pcmToWav(pcm, "audio/L16;codec=pcm;rate=24000");
    expect(wav.slice(0, 4).toString()).toBe("RIFF");
    expect(wav.slice(8, 12).toString()).toBe("WAVE");
    expect(wav.length).toBe(44 + pcm.length);
    // sample rate at offset 24, little-endian
    expect(wav.readUInt32LE(24)).toBe(24000);
  });
});
