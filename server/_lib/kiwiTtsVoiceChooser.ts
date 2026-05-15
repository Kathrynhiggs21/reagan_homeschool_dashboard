/**
 * Wave-15 / Push 226 — kiwiTtsVoiceChooser
 *
 * Pure deterministic helper. The browser's SpeechSynthesis API
 * exposes a list of installed voices. The names vary wildly by
 * OS (macOS "Samantha", Windows "Microsoft Aria", Chrome OS
 * "en-US-Standard-A", etc.). Push 224 set rate/pitch hints; this
 * helper picks the actual VOICE to use so we don't get stuck on
 * a stylized "Kids Voice" preset that undoes our register fix.
 *
 * Strategy (deterministic, ordered):
 *   1. Reject any voice whose name matches the "kiddy/stylized" blocklist
 *      ("kids", "child", "junior", "cartoon", "novelty", "whisper",
 *      "robot", "alien").
 *   2. Filter to lang starting with "en" (English) — Reagan's locale.
 *   3. Prefer voices whose name contains one of the neutral allow-tokens
 *      ("standard", "neutral", "natural", "default") in that order.
 *   4. If nothing matches the allow-tokens, prefer voices marked
 *      .default === true.
 *   5. Otherwise return the first surviving English voice.
 *   6. If the list is empty after blocklisting, return null so the
 *      browser uses its own default.
 *
 * Returns the chosen voice's `voiceURI` (the identifier the
 * frontend passes to `new SpeechSynthesisUtterance().voice`).
 */

export interface TtsVoiceCandidate {
  voiceURI: string;
  name: string;
  lang: string;
  default?: boolean;
}

export interface ChosenTtsVoice {
  voiceURI: string | null;
  name: string | null;
  reason: string;
}

const BLOCKLIST_TOKENS = [
  "kids",
  "kid",
  "child",
  "junior",
  "cartoon",
  "novelty",
  "whisper",
  "robot",
  "alien",
];

const ALLOW_TOKENS = ["standard", "neutral", "natural", "default"];

function tokenizeName(name: string): string {
  return (name || "").toLowerCase();
}

function isBlocked(name: string): boolean {
  const lower = tokenizeName(name);
  return BLOCKLIST_TOKENS.some((b) => lower.includes(b) && b !== "default");
}

function isEnglish(lang: string): boolean {
  return typeof lang === "string" && /^en[-_]/i.test(lang || "");
}

export function chooseKiwiTtsVoice(
  voices: TtsVoiceCandidate[] | undefined,
): ChosenTtsVoice {
  if (!Array.isArray(voices) || voices.length === 0) {
    return {
      voiceURI: null,
      name: null,
      reason: "no_voices_available_use_browser_default",
    };
  }

  const survivors = voices.filter((v) => !isBlocked(v.name));
  if (survivors.length === 0) {
    return {
      voiceURI: null,
      name: null,
      reason: "all_voices_blocked_use_browser_default",
    };
  }

  const english = survivors.filter((v) => isEnglish(v.lang));
  const pool = english.length > 0 ? english : survivors;

  for (const token of ALLOW_TOKENS) {
    const hit = pool.find((v) => tokenizeName(v.name).includes(token));
    if (hit) {
      return {
        voiceURI: hit.voiceURI,
        name: hit.name,
        reason: `matched_allow_token:${token}`,
      };
    }
  }

  const browserDefault = pool.find((v) => v.default === true);
  if (browserDefault) {
    return {
      voiceURI: browserDefault.voiceURI,
      name: browserDefault.name,
      reason: "browser_default_english",
    };
  }

  const first = pool[0];
  return {
    voiceURI: first.voiceURI,
    name: first.name,
    reason: "first_surviving_voice",
  };
}
