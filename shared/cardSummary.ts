/**
 * cardSummary — produce a short, card-facing summary from a long lesson body.
 *
 * Context (2026-06-18): Today schedule cards were rendering the FULL lesson
 * body inline (paragraphs + raw URLs), e.g. the "Why Water Rolls Off a Duck"
 * block became a wall of text. Cards must show only a title + a short
 * description; the full lesson/links/instructions live behind "Open".
 *
 * This helper:
 *  - strips raw URLs (http/https/www and bare domains),
 *  - removes markdown link/image syntax, keeping the visible label,
 *  - collapses whitespace/newlines,
 *  - drops "=== SECTION ===" style headers and leftover markup,
 *  - truncates on a sentence/word boundary to a max length (default ~160 chars),
 *  - appends an ellipsis when it actually trims content.
 *
 * It is intentionally pure + dependency-free so it can be unit-tested and
 * reused on both the client card and (later) the generation side.
 */
export function cardSummary(input?: string | null, maxLen = 160): string {
  if (!input) return "";
  let s = String(input);

  // Markdown images ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Markdown links [label](url) -> label
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Bare URLs (http/https) and www.* and protocol-relative //host
  s = s.replace(/\bhttps?:\/\/\S+/gi, " ");
  s = s.replace(/\bwww\.\S+/gi, " ");
  // Bare domains like example.org/path (avoid eating normal words/decimals:
  // require a known-ish TLD followed by / or end)
  s = s.replace(/\b[\w-]+\.(?:com|org|net|edu|gov|io|co|us)(?:\/\S*)?/gi, " ");
  // "=== HEADER ===" or "--- HEADER ---" section dividers
  s = s.replace(/[=\-]{2,}[^=\-]*[=\-]{2,}/g, " ");
  // Leftover markdown emphasis / heading / code markers
  s = s.replace(/[#*_`>]+/g, " ");
  // Collapse all whitespace (incl. newlines) to single spaces
  s = s.replace(/\s+/g, " ").trim();
  // Tidy spaces left before punctuation
  s = s.replace(/\s+([,.;:!?])/g, "$1");

  if (s.length <= maxLen) return s;

  // Truncate, preferring a sentence end, then a word boundary.
  const slice = s.slice(0, maxLen);
  const lastSentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (lastSentence >= Math.floor(maxLen * 0.5)) {
    return slice.slice(0, lastSentence + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(" ");
  const base = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
  return base.replace(/[,;:.!?]+$/, "") + "…";
}
