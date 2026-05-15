/**
 * Wave-15 / Push 220 — kiwiResponseLengthCapper
 *
 * Pure deterministic helper. Even with the sentence cap baked into
 * the voice prompt (Push 218/219), LLMs still produce 7-sentence
 * essays sometimes. This helper is the post-gen "scissors":
 * truncates Kiwi's reply to N sentences while preserving readable
 * output (no half-sentences, no orphan punctuation).
 *
 * House rules baked in:
 *   - We cap by SENTENCES, never by token count. Sentence-level cuts
 *     read naturally; token cuts produce truncation artifacts.
 *   - If the LLM only returned one long run-on (no sentence-ending
 *     punctuation), we keep the whole thing rather than chopping
 *     mid-word.
 *   - Reagan's preferred reading register is short. We never PAD the
 *     output if it's shorter than the cap.
 *   - Strips any trailing emoji that slipped through the voice guard
 *     (defense-in-depth — emoji is always-off per house rule).
 *   - Trims trailing whitespace + collapses runs of 3+ spaces.
 */

export interface KiwiCappedResult {
  capped: boolean;
  originalSentenceCount: number;
  cappedSentenceCount: number;
  text: string;
}

function stripEmoji(s: string): string {
  // Conservative emoji strip without unicode flag (tsconfig targets ES5).
  // We iterate codepoints and drop any in the common emoji ranges.
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    // High surrogate → detect emoji range via the pair.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {
      const low = s.charCodeAt(i + 1);
      const cp = (code - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
      const isEmoji =
        (cp >= 0x1f300 && cp <= 0x1faff) ||
        (cp >= 0x1f000 && cp <= 0x1f02f);
      if (isEmoji) {
        i += 1; // skip the low surrogate
        continue;
      }
      out += s[i] + s[i + 1];
      i += 1;
      continue;
    }
    if (
      (code >= 0x2600 && code <= 0x27bf) ||
      (code >= 0xfe00 && code <= 0xfe0f)
    ) {
      continue;
    }
    out += s[i];
  }
  return out;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s{3,}/g, "  ").replace(/[ \t]+(\.|\?|!|,)/g, "$1").trim();
}

/**
 * Split text into sentences. Conservative: only splits on . ! ?
 * followed by whitespace + capital letter, OR end-of-string. Keeps
 * the terminating punctuation attached to the sentence so we can
 * rejoin without losing it.
 */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  if (!text) return out;

  // Regex finds sentence-ending punctuation followed by whitespace+capital
  // OR end-of-string. We do it as a manual scan to keep the punctuation.
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "." || ch === "!" || ch === "?") {
      // Look ahead for whitespace + capital-letter OR end-of-string.
      const rest = text.slice(i + 1);
      const m = rest.match(/^(\s+)([A-Z"'(\[])/);
      const atEnd = i === text.length - 1 || /^\s*$/.test(rest);
      if (m || atEnd) {
        const sentence = text.slice(start, i + 1).trim();
        if (sentence.length > 0) out.push(sentence);
        start = i + 1 + (m ? m[1].length : 0);
      }
    }
  }
  const tail = text.slice(start).trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

export function capKiwiResponseLength(
  message: string,
  maxSentences: number,
): KiwiCappedResult {
  const cap = Math.max(1, Math.floor(maxSentences));
  const inputText = typeof message === "string" ? message : "";

  // Defense-in-depth strip of emoji + whitespace normalization.
  const cleaned = normalizeWhitespace(stripEmoji(inputText));

  const sentences = splitSentences(cleaned);

  // No detectable sentence breaks → keep the whole thing (never chop mid-word).
  if (sentences.length === 0) {
    return {
      capped: false,
      originalSentenceCount: 0,
      cappedSentenceCount: 0,
      text: cleaned,
    };
  }

  if (sentences.length <= cap) {
    return {
      capped: false,
      originalSentenceCount: sentences.length,
      cappedSentenceCount: sentences.length,
      text: sentences.join(" ").trim(),
    };
  }

  const kept = sentences.slice(0, cap);
  return {
    capped: true,
    originalSentenceCount: sentences.length,
    cappedSentenceCount: kept.length,
    text: kept.join(" ").trim(),
  };
}
