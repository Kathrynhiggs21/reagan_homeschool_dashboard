/**
 * Push 31 (2026-05-13) \u2014 Canonical worksheet/lesson filename convention.
 *
 * Spec line: "Worksheet/lesson PDF filenames stamped with topic code:
 *             5.OA.1__order-of-ops__worksheet.pdf"
 *
 * Used by any future per-block worksheet exporter (currently the agenda PDF
 * embeds lesson pages inline, so there's no separate worksheet file). When
 * Mom or a tutor exports a single worksheet to print on its own, route that
 * export through this helper so the file lands in Drive with a name that
 * sorts by standard, is grep-able, and survives renames.
 *
 * Format: <code>__<slug>__<kind>.<ext>
 *   - code:  5.OA.1   (sanitized, dots preserved)
 *   - slug:  order-of-ops   (lowercased, [^a-z0-9-]+ collapsed to '-')
 *   - kind:  worksheet | answer-key | lesson | ref
 *   - ext:   pdf | png | docx | md
 *
 * Falls back to a no-topic shape when code is missing:
 *   <slug>__<kind>.<ext>
 */

export type TopicStampedFilenameInput = {
  topicCode?: string | null;
  topicTitle?: string | null;
  /** Free-form fallback if title is missing (e.g. block.title). */
  fallbackTitle?: string | null;
  kind: "worksheet" | "answer-key" | "lesson" | "ref";
  ext: "pdf" | "png" | "docx" | "md";
};

const KEEP_ALNUM_DOTS = /[^a-zA-Z0-9.]/g;
const SLUG_REPLACE = /[^a-z0-9]+/g;

function sanitizeCode(code: string): string {
  return code.replace(KEEP_ALNUM_DOTS, "").slice(0, 32);
}

function slugify(s: string, maxLen = 40): string {
  return s
    .toLowerCase()
    .replace(SLUG_REPLACE, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen) || "untitled";
}

export function topicStampedFilename(input: TopicStampedFilenameInput): string {
  const titleSource = (input.topicTitle?.trim() || input.fallbackTitle?.trim() || "untitled");
  const slug = slugify(titleSource);
  const kind = input.kind;
  const ext = input.ext;
  if (input.topicCode && input.topicCode.trim().length > 0) {
    const code = sanitizeCode(input.topicCode.trim());
    return `${code}__${slug}__${kind}.${ext}`;
  }
  return `${slug}__${kind}.${ext}`;
}
