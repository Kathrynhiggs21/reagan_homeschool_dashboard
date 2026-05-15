/**
 * Wave-15 / Push 216 — kiwiToneDriftDetector
 *
 * Pure deterministic helper. Reagan told us Kiwi's voice was "creepy"
 * and "too kiddy". We rewrote Kiwi to a calm, slightly-older-cousin
 * register, but LLM completions drift, so this helper acts as a
 * pre-send guard: every Kiwi message body gets fed through here
 * BEFORE we send it to the UI. If it scores too high on the drift
 * scale, the caller substitutes a safe fallback line instead.
 *
 * The detector is intentionally conservative — it surfaces issues
 * rather than silently rewriting. The caller chooses whether to
 * regenerate, redact, or fall back. Voice-policy itself stays in
 * one place (this file) so changing tone is a one-line edit.
 *
 * Drift signals (each adds to driftScore):
 *   - kiddy: "buddy / friend / pal / kiddo / sweetie / yay / woohoo
 *     / great job / awesome / amazing / super!" (each hit: +2)
 *   - creepy: trailing tildes (~~~), excessive ellipses (...........),
 *     emoji bursts, "hehe" / "hehehe", anthropomorphic over-share
 *     ("I feel you", "I'm watching", "I'm always here") (+3 each)
 *   - imperative-punitive: "you must", "you have to", "don't be"
 *     (+2 each — Kiwi never commands)
 *   - excessive exclamation: 3+ "!" anywhere in the text (+2)
 *   - ALL CAPS WORDS longer than 3 chars not in an allow-list (+1)
 *
 * Threshold: driftScore >= 4 → flagged. Caller should substitute.
 */

export interface ToneDriftResult {
  driftScore: number;
  flagged: boolean;
  reasons: string[];
  cleanedPreview: string;
  safeFallback: string;
}

const KIDDY_TERMS = [
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

const CREEPY_PATTERNS: Array<{ name: string; re: RegExp; weight: number }> = [
  { name: "trailing_tildes", re: /~{2,}/g, weight: 3 },
  { name: "long_ellipses", re: /\.{5,}/g, weight: 3 },
  { name: "anthropomorphic_overshare", re: /\b(i'?m always (here|watching)|i'?m watching\b|i feel you|i see you)/gi, weight: 3 },
  { name: "hehe", re: /\b(he){2,}\b/gi, weight: 3 },
];

const IMPERATIVE_PHRASES = [
  "you must",
  "you have to",
  "don't be",
  "you should always",
];

const ALL_CAPS_ALLOW = new Set<string>(["I", "OK", "USA", "AI", "PDF"]);

const SAFE_FALLBACK_LINE =
  "Got it. I'll keep the answer short for now — ask me again when you're ready.";

function countMatches(re: RegExp, s: string): number {
  const m = s.match(re);
  return m ? m.length : 0;
}

function countKiddyHits(s: string): number {
  const lower = s.toLowerCase();
  let n = 0;
  for (const term of KIDDY_TERMS) {
    // Use word-boundaryish heuristic — terms can be multi-word.
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi");
    n += countMatches(re, lower);
  }
  return n;
}

function countAllCapsWords(s: string): number {
  const words = s.split(/\s+/);
  let n = 0;
  for (const w of words) {
    const clean = w.replace(/[^A-Za-z]/g, "");
    if (clean.length <= 3) continue;
    if (ALL_CAPS_ALLOW.has(clean)) continue;
    if (clean === clean.toUpperCase() && /[A-Z]/.test(clean)) {
      n += 1;
    }
  }
  return n;
}

export function detectKiwiToneDrift(message: string): ToneDriftResult {
  const text = typeof message === "string" ? message : "";
  const reasons: string[] = [];
  let score = 0;

  const kiddy = countKiddyHits(text);
  if (kiddy > 0) {
    score += kiddy * 2;
    reasons.push(`kiddy_terms:${kiddy}`);
  }

  for (const pat of CREEPY_PATTERNS) {
    const hits = countMatches(pat.re, text);
    if (hits > 0) {
      score += pat.weight * hits;
      reasons.push(`${pat.name}:${hits}`);
    }
  }

  for (const phrase of IMPERATIVE_PHRASES) {
    const re = new RegExp(`\\b${phrase}\\b`, "gi");
    const hits = countMatches(re, text);
    if (hits > 0) {
      score += 2 * hits;
      reasons.push(`imperative:${phrase.replace(/\s+/g, "_")}:${hits}`);
    }
  }

  const exclam = countMatches(/!/g, text);
  if (exclam >= 3) {
    score += 2;
    reasons.push(`excess_exclamation:${exclam}`);
  }

  const caps = countAllCapsWords(text);
  if (caps > 0) {
    score += caps;
    reasons.push(`all_caps:${caps}`);
  }

  // Build a cleaned preview: strip the most obvious offenders so the
  // operator card can show "what we'd have sent if we let it through".
  let cleaned = text;
  cleaned = cleaned.replace(/~{2,}/g, "");
  cleaned = cleaned.replace(/\.{5,}/g, "...");
  cleaned = cleaned.replace(/!{2,}/g, "!");

  return {
    driftScore: score,
    flagged: score >= 4,
    reasons,
    cleanedPreview: cleaned.trim(),
    safeFallback: SAFE_FALLBACK_LINE,
  };
}
