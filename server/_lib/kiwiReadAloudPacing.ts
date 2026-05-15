/**
 * Wave-15 / Push 224 — kiwiReadAloudPacing
 *
 * Pure deterministic helper. The dashboard has a "Read" speaker
 * button on Kiwi cards (visible in screenshots) — when Reagan taps
 * it, the text gets read aloud via TTS. The voice-rewrite ("less
 * kiddy / less creepy") only fixed the TEXT; we now need to make
 * sure the TTS DELIVERY matches the older-cousin register too.
 * Otherwise an over-cheerful TTS preset will undo the calm voice.
 *
 * Returns pacing hints (rate, pitch, pause-after-period, voice
 * preference) that the frontend Speech Synthesis call uses.
 *
 * Pacing presets per voice profile:
 *   - older_cousin  → rate 0.95, pitch 0.95, normal pauses
 *   - neutral_calm  → rate 0.90, pitch 0.90, longer pauses
 *   - study_buddy   → rate 1.00, pitch 0.95, normal pauses (focus mode)
 *
 * House rules:
 *   - rate and pitch are both BELOW 1.0 by default. Cheerful TTS
 *     defaults are usually 1.1+; we explicitly walk it down.
 *   - voicePreference is "default" so the system picks the most
 *     neutral installed voice rather than a stylized one.
 *   - Returns SSML-style pause markers (used by frontend if the
 *     browser supports it) AND plain rate/pitch values (fallback).
 */

import type { KiwiVoiceProfileId } from "./kiwiVoiceSettings";

export interface KiwiReadAloudPacing {
  profile: KiwiVoiceProfileId;
  rate: number; // SpeechSynthesisUtterance.rate (0.1–10, default 1)
  pitch: number; // SpeechSynthesisUtterance.pitch (0–2, default 1)
  pauseAfterPeriodMs: number; // hint for SSML <break/> insertion
  voicePreference: "default" | "neutral";
  ssmlHint: string; // pre-wrapped SSML if the frontend prefers it
}

const PRESETS: Record<KiwiVoiceProfileId, Omit<KiwiReadAloudPacing, "ssmlHint">> = {
  older_cousin: {
    profile: "older_cousin",
    rate: 0.95,
    pitch: 0.95,
    pauseAfterPeriodMs: 250,
    voicePreference: "default",
  },
  neutral_calm: {
    profile: "neutral_calm",
    rate: 0.9,
    pitch: 0.9,
    pauseAfterPeriodMs: 350,
    voicePreference: "neutral",
  },
  study_buddy: {
    profile: "study_buddy",
    rate: 1.0,
    pitch: 0.95,
    pauseAfterPeriodMs: 250,
    voicePreference: "default",
  },
};

function buildSsml(text: string, pauseMs: number, rate: number, pitch: number): string {
  const escaped = (typeof text === "string" ? text : "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withPauses = escaped.replace(
    /([.!?])(\s|$)/g,
    `$1<break time="${pauseMs}ms"/>$2`,
  );
  const ratePct = Math.round(rate * 100);
  const pitchSt = Math.round((pitch - 1) * 10);
  const pitchAttr = pitchSt >= 0 ? `+${pitchSt}st` : `${pitchSt}st`;
  return `<speak><prosody rate="${ratePct}%" pitch="${pitchAttr}">${withPauses}</prosody></speak>`;
}

export function getKiwiReadAloudPacing(
  profile: KiwiVoiceProfileId = "older_cousin",
  text: string = "",
): KiwiReadAloudPacing {
  const preset = PRESETS[profile] ?? PRESETS.older_cousin;
  return {
    ...preset,
    ssmlHint: buildSsml(text, preset.pauseAfterPeriodMs, preset.rate, preset.pitch),
  };
}
