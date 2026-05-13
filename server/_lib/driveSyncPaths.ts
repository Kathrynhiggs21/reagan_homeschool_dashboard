/**
 * Push 92 (2026-05-13) — Drive sync filename/path helpers (pure).
 *
 * The dashboard already has multiple call sites that hand-roll filenames
 * for `drivePushQueue` rows: day logs, recap replies, off-plan topics,
 * agenda PDFs. They've each drifted slightly (some pad month numbers,
 * some don't; some sanitize differently). This module is the single
 * canonical formatter Mom + Grandma can rely on:
 *
 *   monthBucket(dateISO) → "YYYY-MM"      (matches Drive subpath)
 *   safeNameSegment(s)   → "_Some_Name_"  (alnum + _ + - only, len ≤ 80)
 *   offPlanTopicFile(...) → "{date} - {subject} - {topic}.md"
 *   recapReplyFile(...)   → "{date} - {sender} - Recap.md"
 *   dayLogFile(...)       → "{date} - Day Log.md"
 *   agendaPdfFile(...)    → "{date} - Agenda.pdf"
 *
 * Pure: no DB, no env, no time.
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateIso(dateISO: string): boolean {
  return ISO_RE.test(dateISO);
}

export function monthBucket(dateISO: string): string {
  if (!isValidDateIso(dateISO)) {
    throw new Error(`monthBucket: dateISO must be YYYY-MM-DD (got "${dateISO}")`);
  }
  return dateISO.slice(0, 7);
}

/**
 * Reduce free-form text to a Drive-safe filename fragment:
 *   - non-alnum collapsed to `_`
 *   - trimmed to <= 80 chars
 *   - empty input → "untitled"
 *   - leading/trailing underscores stripped
 */
export function safeNameSegment(input: string | null | undefined): string {
  if (!input) return "untitled";
  let s = String(input).replace(/[^A-Za-z0-9]+/g, "_");
  s = s.replace(/^_+|_+$/g, "");
  if (!s) return "untitled";
  return s.slice(0, 80);
}

export function offPlanTopicFile(
  dateISO: string,
  subjectSlug: string,
  topic: string,
): string {
  if (!isValidDateIso(dateISO)) {
    throw new Error(`offPlanTopicFile: bad date "${dateISO}"`);
  }
  const subj = safeNameSegment(subjectSlug);
  const top = safeNameSegment(topic);
  return `${dateISO} - ${subj} - ${top}.md`;
}

export function recapReplyFile(dateISO: string, sender: string): string {
  if (!isValidDateIso(dateISO)) {
    throw new Error(`recapReplyFile: bad date "${dateISO}"`);
  }
  const who = safeNameSegment(sender);
  return `${dateISO} - ${who} - Recap.md`;
}

export function dayLogFile(dateISO: string): string {
  if (!isValidDateIso(dateISO)) {
    throw new Error(`dayLogFile: bad date "${dateISO}"`);
  }
  return `${dateISO} - Day Log.md`;
}

export function agendaPdfFile(dateISO: string): string {
  if (!isValidDateIso(dateISO)) {
    throw new Error(`agendaPdfFile: bad date "${dateISO}"`);
  }
  return `${dateISO} - Agenda.pdf`;
}

/**
 * Resolve a complete `{ targetFolder, targetSubpath, fileName, mimeType }`
 * tuple for an off-plan capture going to Drive. The caller plugs this
 * into a single `drivePushQueue` insert; no more hand-rolled paths.
 */
export type DriveSyncDescriptor = {
  targetFolder:
    | "topics_covered"
    | "day_log"
    | "recap_reply"
    | "agenda_pdf";
  targetSubpath: string;
  fileName: string;
  mimeType: string;
};

export function describeOffPlanSync(
  dateISO: string,
  subjectSlug: string,
  topic: string,
): DriveSyncDescriptor {
  return {
    targetFolder: "topics_covered",
    targetSubpath: monthBucket(dateISO),
    fileName: offPlanTopicFile(dateISO, subjectSlug, topic),
    mimeType: "text/markdown",
  };
}

export function describeDayLogSync(dateISO: string): DriveSyncDescriptor {
  return {
    targetFolder: "day_log",
    targetSubpath: monthBucket(dateISO),
    fileName: dayLogFile(dateISO),
    mimeType: "text/markdown",
  };
}

export function describeRecapReplySync(
  dateISO: string,
  sender: string,
): DriveSyncDescriptor {
  return {
    targetFolder: "recap_reply",
    targetSubpath: monthBucket(dateISO),
    fileName: recapReplyFile(dateISO, sender),
    mimeType: "text/markdown",
  };
}

export function describeAgendaPdfSync(dateISO: string): DriveSyncDescriptor {
  return {
    targetFolder: "agenda_pdf",
    targetSubpath: monthBucket(dateISO),
    fileName: agendaPdfFile(dateISO),
    mimeType: "application/pdf",
  };
}
