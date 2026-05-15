/**
 * Wave-15 / Push 228 — kiwiNicknameGuard
 *
 * Pure deterministic helper. After the "less kiddy" voice rewrite,
 * a subtler failure mode remains: Kiwi addresses Reagan as
 * "sweetie", "champ", "honey", "kid", "little one". These aren't
 * banned by the toneDriftDetector's kiddy-terms list because they
 * read as endearments rather than register cues — but they still
 * undo the older-cousin voice if they slip into a reply.
 *
 * This helper scans for *forms of address* directed at Reagan
 * (typically appearing right after a vocative comma, at the start,
 * or at the end of a sentence), redacts them, and returns the
 * cleaned text plus the list of nicknames it caught.
 *
 * The drift detector still runs on the original text; this is a
 * surgical *redact* not a *flag*, because nicknames can be cleaned
 * out without losing the reply's actual content (unlike a tone-
 * drifted reply where the whole register is wrong).
 *
 * Banned nicknames (case-insensitive, word-boundary):
 *   buddy, friend, pal, kiddo, kid, sweetie, sweetheart, honey,
 *   hun, hon, champ, champion, little one, dear, darling, sport,
 *   tiger, princess, queen (when used as address), girl, girlie,
 *   missy, sister, sis
 *
 * Reagan's actual name is allowed. The helper does NOT redact
 * "Reagan" — that's correct addressing.
 *
 * Output:
 *   - cleanedText: same text with nicknames removed and any leading
 *     comma+space collapsed.
 *   - redactedTerms: distinct nicknames that were redacted (for audit).
 *   - changed: true if any redaction happened.
 */

export interface NicknameGuardResult {
  cleanedText: string;
  redactedTerms: string[];
  changed: boolean;
}

const NICKNAMES = [
  "buddy",
  "friend",
  "pal",
  "kiddo",
  "kid",
  "sweetie",
  "sweetheart",
  "honey",
  "hun",
  "hon",
  "champ",
  "champion",
  "little one",
  "dear",
  "darling",
  "sport",
  "tiger",
  "princess",
  "queen",
  "girl",
  "girlie",
  "missy",
  "sister",
  "sis",
];

// Helper: escape regex special chars from a literal phrase.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a regex that catches nicknames in *vocative* position only:
 *   - "Hey, sweetie," → match ", sweetie,"
 *   - "Sweetie, listen" → match "Sweetie, "
 *   - "Listen up, champ." → match ", champ."
 *   - "Listen, champ" (end of clause) → match ", champ"
 * Avoids false positives like the word "kid" in "the kids' room"
 * by requiring punctuation/whitespace boundaries on both sides.
 */
function buildVocativeRegex(): RegExp {
  const alts = NICKNAMES.map(escapeRegex).join("|");
  // Cases (case-insensitive):
  //   (A) leading: ^(nickname)\b[ ,!?]+
  //   (B) middle:  [ ,]+(nickname)\b[ ,!?]+
  //   (C) trailing:[ ,]+(nickname)\b\s*[.!?]?$
  // Combined into a single alternation.
  const pattern =
    `(^(?:${alts})\\b[ ,!?]+)` +
    `|([ ,]+(?:${alts})\\b[ ,!?]+)` +
    `|([ ,]+(?:${alts})\\b[\\s]*[.!?]?$)`;
  return new RegExp(pattern, "gi");
}

const VOCATIVE_RE = buildVocativeRegex();

export function guardKiwiNicknames(message: string): NicknameGuardResult {
  const text = typeof message === "string" ? message : "";
  if (text.length === 0) {
    return { cleanedText: "", redactedTerms: [], changed: false };
  }

  const redactedSet = new Set<string>();
  // Replace each match. For leading position, drop the whole thing.
  // For middle position, replace with a single space.
  // For trailing position, replace with the terminal punctuation if any.
  const cleaned = text.replace(VOCATIVE_RE, (match: string) => {
    const lower = match.toLowerCase();
    for (const nick of NICKNAMES) {
      if (lower.includes(nick)) {
        redactedSet.add(nick);
        break;
      }
    }
    // Preserve a single space if the match was middle-of-sentence.
    if (/^[ ,]/.test(match) && /[ ,!?]$/.test(match) && !/[.!?]$/.test(match.trim())) {
      return " ";
    }
    // If the match ends with a sentence terminator, preserve it.
    const terminator = match.trim().slice(-1);
    if (terminator === "." || terminator === "!" || terminator === "?") {
      return terminator;
    }
    return "";
  });

  const collapsed = cleaned
    .replace(/^\s+/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.!?,])/g, "$1")
    .trim();

  const redactedTerms = Array.from(redactedSet).sort();
  return {
    cleanedText: collapsed,
    redactedTerms,
    changed: redactedTerms.length > 0,
  };
}
