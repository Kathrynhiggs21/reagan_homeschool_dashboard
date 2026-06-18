/**
 * wakeWord.ts — pure helpers for Kiwi's wake-word listener.
 *
 * The browser SpeechRecognition transcript is a single lowercase-able string.
 * When Reagan says "Kiwi, what's first today?" we want to:
 *   1) detect that the wake word (her companion's name, default "kiwi") is present
 *   2) pull out everything she said AFTER the name as her actual question
 *
 * Keeping this logic pure (no DOM, no React) so it can be unit-tested and so the
 * listener component stays thin.
 */

/** Build the list of trigger phrases for a given companion name. */
export function wakeTriggers(companionName: string): string[] {
  const name = (companionName || "kiwi").trim().toLowerCase();
  const triggers = new Set<string>([
    `hi ${name}`,
    `hey ${name}`,
    `ok ${name}`,
    `okay ${name}`,
    name,
    // always allow the literal default name too, in case the companion was renamed
    "hi kiwi",
    "hey kiwi",
    "ok kiwi",
    "kiwi",
  ]);
  return Array.from(triggers);
}

/** True when the transcript contains the wake word / a greeting form of it. */
export function transcriptHasWakeWord(transcript: string, companionName: string): boolean {
  const text = (transcript || "").toLowerCase();
  if (!text.trim()) return false;
  const name = (companionName || "kiwi").trim().toLowerCase();
  // Word-boundary-ish match so "kiwifruit" doesn't trigger but "kiwi," does.
  const re = new RegExp(`(^|[^a-z])(${escapeRe(name)}|kiwi)([^a-z]|$)`, "i");
  return re.test(text);
}

/**
 * Extract Reagan's question from a transcript that contains the wake word.
 * Returns the trimmed text AFTER the last wake-word occurrence, with any
 * leading greeting filler ("hi", "hey", "ok") and punctuation stripped.
 * Returns "" when she only said the name with nothing meaningful after it.
 */
export function extractQuestionAfterWake(transcript: string, companionName: string): string {
  const raw = (transcript || "").trim();
  if (!raw) return "";
  const name = (companionName || "kiwi").trim().toLowerCase();
  const lower = raw.toLowerCase();

  // Find the last occurrence of either the custom name or the literal "kiwi".
  const idxName = lastIndexOfWord(lower, name);
  const idxKiwi = lastIndexOfWord(lower, "kiwi");
  const idx = Math.max(idxName, idxKiwi);
  if (idx < 0) {
    // No wake word at all — treat the whole utterance as the question.
    return cleanFragment(raw);
  }
  // Pick the length of whichever word actually sits at `idx` (handles the
  // case where name and "kiwi" tie, or one is a substring of the other).
  const matchLen = idx === idxKiwi ? "kiwi".length : name.length;
  const after = raw.slice(idx + matchLen);
  return cleanFragment(after);
}

/** Index of `word` as a whole-ish word (preceded by start/non-letter). -1 if absent. */
function lastIndexOfWord(haystack: string, word: string): number {
  if (!word) return -1;
  // Trailing boundary is a lookahead so adjacent occurrences ("kiwi kiwi ...")
  // aren't swallowed by the previous match consuming the separating space.
  const re = new RegExp(`(^|[^a-z])${escapeRe(word)}(?=[^a-z]|$)`, "gi");
  let m: RegExpExecArray | null;
  let last = -1;
  while ((m = re.exec(haystack)) !== null) {
    last = m.index + (m[1]?.length ?? 0);
    if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width loop
  }
  return last;
}

/** Strip leading greeting words, punctuation, and surrounding whitespace. */
function cleanFragment(s: string): string {
  return s
    .replace(/^[\s,.;:!?\-—]+/, "")
    .replace(/^(hi|hey|ok|okay|um|uh|so|well)\b[\s,.;:!?\-—]*/i, "")
    .replace(/^[\s,.;:!?\-—]+/, "")
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Stop phrases that send Kiwi back to passive wake-word waiting while she is
 * mid-conversation. Reagan can say "bye Kiwi", "stop", "that's all", etc.
 * Kept generous but specific enough to avoid false positives mid-sentence.
 */
export function transcriptHasStopPhrase(transcript: string, companionName: string): boolean {
  const text = (transcript || "").toLowerCase().trim();
  if (!text) return false;
  const name = (companionName || "kiwi").trim().toLowerCase();
  const namePart = `(?:${escapeRe(name)}|kiwi)`;
  const patterns: RegExp[] = [
    new RegExp(`\\b(bye|goodbye|good bye|see ya|see you|night|goodnight|good night)\\b[\\s,.!]*${namePart}?`, "i"),
    new RegExp(`\\b${namePart}[\\s,.!]*(bye|goodbye|stop|go away|be quiet|quiet|that'?s all|thank you|thanks)\\b`, "i"),
    /\b(stop talking|be quiet|go to sleep|go away|that'?s all for now|that'?s enough|nevermind|never mind)\b/i,
    /^(stop|quiet|bye|goodbye|shush)[\s.!,]*$/i,
  ];
  return patterns.some((re) => re.test(text));
}

