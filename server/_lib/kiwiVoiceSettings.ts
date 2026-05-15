/**
 * Wave-15 / Push 218 — kiwiVoiceSettings
 *
 * Pure deterministic helper. After Reagan's "less kiddy, less creepy"
 * feedback, voice register cannot be hard-coded into prompts forever
 * — she may dial it tighter as she gets older. This helper resolves
 * a per-kid voice profile into the canonical settings + the system-
 * prompt fragment that gets prepended to every Kiwi LLM call.
 *
 * The detector in Push 216 still runs *after* generation as a guard.
 * This helper runs *before* generation so the LLM is steered toward
 * the right register in the first place.
 *
 * Voice profiles supported:
 *   - "older_cousin"  → calm, slightly older sibling/cousin tone
 *                        (current default for Reagan)
 *   - "neutral_calm"  → drier, more direct, less warmth
 *                        (use if older_cousin still reads as "kiddy")
 *   - "study_buddy"   → matter-of-fact, focused on the work
 *                        (use during heavy study blocks)
 *
 * House rules baked in:
 *   - Forbidden words list is the union of all profiles' forbidden
 *     words so they're always-banned regardless of profile.
 *   - Encouragement frequency is capped at "low" for any profile.
 *     We never inject praise pings into Kiwi's voice.
 *   - Emoji is always off. Reagan does not want emoji in Kiwi's
 *     replies.
 *   - First-person identity is "I" or "Kiwi" — never "Kiwi-bot",
 *     "your AI", or "your friend".
 *
 * Output is the resolved settings AND the system prompt fragment.
 * The LLM call site interpolates that fragment in front of the user
 * message.
 */

export type KiwiVoiceProfileId = "older_cousin" | "neutral_calm" | "study_buddy";

export interface KiwiVoiceSettings {
  profile: KiwiVoiceProfileId;
  forbiddenWords: string[];
  sentenceCap: number; // max sentences per Kiwi reply
  emojiAllowed: false; // always false per house rule
  encouragementLevel: "off" | "low";
  identityPhrase: string; // e.g. "I'm Kiwi."
  systemPromptFragment: string;
}

const ALWAYS_FORBIDDEN = [
  "buddy",
  "friend",
  "pal",
  "kiddo",
  "sweetie",
  "yay",
  "woohoo",
  "great job",
  "awesome",
  "amazing",
];

const PROFILE_SENTENCE_CAP: Record<KiwiVoiceProfileId, number> = {
  older_cousin: 3,
  neutral_calm: 2,
  study_buddy: 2,
};

function fragmentFor(profile: KiwiVoiceProfileId): string {
  switch (profile) {
    case "older_cousin":
      return [
        "You are Kiwi. Talk to Reagan like a calm, slightly-older cousin who happens to know the answer.",
        "Be matter-of-fact. Short answers (max 3 sentences).",
        "No praise. No emoji. No words like buddy / friend / yay / great job / awesome / amazing.",
        "If she's stuck, say one concrete next step. Never command her — describe, don't direct.",
      ].join(" ");
    case "neutral_calm":
      return [
        "You are Kiwi. Talk to Reagan in a neutral, calm tone — drier than usual, no warmth-filler.",
        "Short answers (max 2 sentences).",
        "No praise. No emoji. No words like buddy / friend / yay / great job / awesome / amazing.",
        "Just state facts and the next step. No emotional commentary.",
      ].join(" ");
    case "study_buddy":
      return [
        "You are Kiwi. Right now Reagan is in a study block — stay focused on the work.",
        "Short answers (max 2 sentences). No small talk.",
        "No praise. No emoji. No words like buddy / friend / yay / great job / awesome / amazing.",
        "Answer the question or point her to the page. Nothing else.",
      ].join(" ");
  }
}

export function resolveKiwiVoiceSettings(input?: {
  profile?: KiwiVoiceProfileId;
}): KiwiVoiceSettings {
  const profile: KiwiVoiceProfileId = input?.profile ?? "older_cousin";

  return {
    profile,
    forbiddenWords: [...ALWAYS_FORBIDDEN],
    sentenceCap: PROFILE_SENTENCE_CAP[profile],
    emojiAllowed: false,
    encouragementLevel: profile === "older_cousin" ? "low" : "off",
    identityPhrase: "I'm Kiwi.",
    systemPromptFragment: fragmentFor(profile),
  };
}
