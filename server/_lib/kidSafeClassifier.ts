/**
 * Kid-safe content classifier for Reagan's Kiwi Helper.
 *
 * Push 28 (2026-05-13) — closes the long-standing Phase 6 todo item
 * "Kiwi-Helper kid-safe content filter: server-side classifier blocks
 * unsafe queries before answering."
 *
 * Design choices Mom signed off on:
 *   1. Deterministic regex prefilter only. No LLM cost, no network
 *      dependency, can't fail-open if the LLM endpoint is down. Reagan
 *      is 11 and the failure mode of "let it through and apologize"
 *      is unacceptable here.
 *   2. Categories cover the realistic 5th-grade attack surface, not
 *      adult-grade red-team scenarios:
 *        - violence / weapons how-tos
 *        - self-harm / suicide ideation (escalates to alerting Mom)
 *        - explicit sexual content
 *        - scary / horror content (rated PG-13+ themes she has
 *          asked about before per Mom's whiteboard notes)
 *        - personal-info disclosure (Reagan's address, school name,
 *          phone) being requested OR offered to Kiwi
 *        - contact-with-strangers requests ("can you call my friend",
 *          "give me a phone number to text")
 *   3. False positives are okay; false negatives are not. The reply
 *      is always a soft Kiwi-voiced redirect, never a robotic refusal.
 *   4. Every flag also calls notifyOwner so Mom sees what was tried
 *      (separately from the chat log she can already read).
 */

export type KidSafeCategory =
  | "violence"
  | "self_harm"
  | "explicit"
  | "scary_horror"
  | "personal_info"
  | "stranger_contact";

export interface KidSafeResult {
  /** True when at least one rule matched. */
  flagged: boolean;
  /** Matched categories (multi-label allowed). */
  categories: KidSafeCategory[];
  /** First matching pattern, useful for the audit notification. */
  matchedSnippet?: string;
  /** The kid-friendly Kiwi reply we should send back instead of an LLM call. */
  redirect: string;
}

interface Rule {
  category: KidSafeCategory;
  pattern: RegExp;
}

/**
 * Word-boundary helper. We deliberately avoid matching inside larger
 * words (e.g. "killer whale" must NOT match "kill"). Each phrase is
 * lowercased before matching.
 */
function wb(...phrases: string[]): RegExp {
  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
}

const RULES: Rule[] = [
  // ---- self-harm / suicide (highest priority — alerts Mom) ----
  { category: "self_harm", pattern: wb("kill myself", "hurt myself", "cut myself", "end my life", "want to die", "suicide", "no reason to live") },

  // ---- violence (how-tos, not "killer whale" / "kill the boss in roblox") ----
  // We require both a violent verb AND a person/animal target to reduce false flags.
  { category: "violence", pattern: /\b(?:how (?:do|can|to) (?:i|you|we) )?(?:make|build|craft) (?:a )?(?:bomb|gun|knife|weapon)\b/i },
  { category: "violence", pattern: /\b(?:how (?:do|to) )?(?:hurt|attack|stab|shoot|punch|beat up|fight) (?:(?:my|a|the|that) )?(?:teacher|sister|brother|mom|dad|kid|person|baby|animal|cat|dog|horse|bird)\b/i },

  // ---- explicit / sexual ----
  { category: "explicit", pattern: wb("sex", "porn", "naked body", "boobs", "penis", "vagina", "make a baby", "horny") },

  // ---- scary / horror (Mom's whiteboard says block these because Reagan asks at night) ----
  { category: "scary_horror", pattern: wb("scary story", "horror movie", "ghost story", "haunted house", "killer clown", "demon", "possessed") },

  // ---- personal info — disclosure OR request ----
  // Phone numbers (10+ digit runs)
  { category: "personal_info", pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/ },
  // Email addresses
  { category: "personal_info", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  // Address-shape strings
  { category: "personal_info", pattern: /\b\d{1,5}\s+[A-Z][a-z]+\s+(?:St|Ave|Rd|Blvd|Ln|Dr|Way|Ct|Pl)\b/ },
  // Asking for personal details
  { category: "personal_info", pattern: /\b(?:what(?:'s| is)? (?:my|your|reagan'?s?) )?(?:home address|phone number|social security|credit card|ssn)\b/i },

  // ---- stranger contact ----
  { category: "stranger_contact", pattern: /\b(?:call|text|email|message|dm) (?:a )?(?:stranger|someone|random|that person|him|her)\b/i },
  { category: "stranger_contact", pattern: /\b(?:meet up with|run away with|go (?:see|to)) (?:a )?stranger\b/i },
];

/**
 * Pick a soft Kiwi-voiced redirect for the matched categories. Order
 * matters: self-harm wins over everything else because Mom needs to
 * know FAST.
 */
function buildRedirect(categories: KidSafeCategory[]): string {
  if (categories.includes("self_harm")) {
    return "I'm so glad you told me how you feel. That's a big feeling, and you don't have to carry it by yourself. Let's go find your mom right now — I'll come with you. You're safe with me.";
  }
  if (categories.includes("violence")) {
    return "I won't help with hurting anyone — that's a Kiwi rule, even pretend. But if someone is bothering you, tell your mom or your dad and I'll cheer you on the whole time. Want to talk about something else?";
  }
  if (categories.includes("explicit")) {
    return "That's a grown-up topic, so it's not something I help with. But your mom is a great person to ask anytime — promise. Want me to help with school or animals instead?";
  }
  if (categories.includes("scary_horror")) {
    return "Ooh, I don't do scary stuff — it makes my feathers fluff up. Want a silly joke or a cozy animal fact instead?";
  }
  if (categories.includes("personal_info")) {
    return "Let's keep stuff like phone numbers and addresses just between you and your family — that's a safety rule. I'll always be here for the school stuff and the cozy stuff.";
  }
  if (categories.includes("stranger_contact")) {
    return "Talking to people you don't know is something only your mom or dad should help with, never me. But if you want to send a note to someone you DO know, you can use the \"Make a request\" button at the top — your family will get it.";
  }
  return "Let's pick something else to chat about — I'm better at school stuff, animals, and silly jokes anyway.";
}

/**
 * Run every rule and return a result. Always returns a redirect string
 * even when not flagged so callers can use it as a safe fallback.
 */
export function classifyKidSafe(input: string): KidSafeResult {
  const text = (input || "").trim();
  if (!text) {
    return { flagged: false, categories: [], redirect: buildRedirect([]) };
  }
  const hits: KidSafeCategory[] = [];
  let firstSnippet: string | undefined;
  for (const rule of RULES) {
    const m = text.match(rule.pattern);
    if (m) {
      if (!hits.includes(rule.category)) hits.push(rule.category);
      if (!firstSnippet) firstSnippet = m[0];
    }
  }
  return {
    flagged: hits.length > 0,
    categories: hits,
    matchedSnippet: firstSnippet,
    redirect: buildRedirect(hits),
  };
}
