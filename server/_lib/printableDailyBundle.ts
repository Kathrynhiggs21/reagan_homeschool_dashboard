/**
 * Push 131 (2026-05-13) — Printable daily-schedule + worksheet bundle planner.
 *
 * Mom's standing rule (project memory):
 *   "Printable button on the homepage to print the daily details schedule
 *    and worksheet view. Worksheets should be adjustable for printing so
 *    that they can be answered offline, with an option to submit a picture
 *    of the completed worksheet."
 *
 * Pure planning helper. Given a day's planned blocks + the per-block lesson
 * hydration result, decide WHICH PDFs go into the printable bundle, in
 * WHAT ORDER, with WHAT page footer, and EMIT the photo-submit QR target
 * URL (one per worksheet). No I/O. The PDF assembler downstream consumes
 * this plan.
 *
 * Excludes morning_vibe blocks (Slay Charge ⚡) by contract — they are not
 * assignments and must never appear on a printable.
 */

export type PrintableSectionKind =
  | "cover"
  | "schedule-overview"
  | "block-page"
  | "worksheet"
  | "answer-key-adult"
  | "submit-instructions";

export interface PlannedBlockForPrintable {
  blockId: string;
  /** start time HH:MM (24h). */
  startHHmm: string;
  /** integer minutes. */
  durationMin: number;
  title: string;
  subject: string | null;
  /** Internal block type — morning_vibe blocks are excluded. */
  type: string;
  worksheetPdfKey: string | null;
  answerKeyPdfKey: string | null;
  lessonPdfKey: string | null;
}

export interface PrintableBundleInput {
  dateIso: string; // YYYY-MM-DD
  blocks: ReadonlyArray<PlannedBlockForPrintable>;
  tutorOfDayName: string | null;
  /**
   * Adult tier of the requestor. Answer keys + adult-only sections are
   * skipped for kid-tier prints.
   */
  audienceTier: "kid" | "adult";
  /**
   * Base URL for the photo-submit deeplink (the QR target on each
   * worksheet page). Must be HTTPS and have no trailing slash.
   */
  submitBaseUrl: string;
}

export type PrintableBundleOutcome =
  | {
      kind: "ready";
      sections: ReadonlyArray<PrintableSection>;
      footerLine: string;
    }
  | {
      kind: "blocked";
      reason:
        | "bad-date"
        | "no-printable-blocks"
        | "missing-submit-base-url"
        | "submit-base-url-not-https";
    };

export interface PrintableSection {
  kind: PrintableSectionKind;
  /** Stable section id for downstream PDF assembler (debug, audit). */
  sectionId: string;
  title: string;
  /** For block-page / worksheet / answer-key kinds. */
  blockId?: string;
  pdfKey?: string | null;
  submitDeeplink?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function compareBlocksByStart(
  a: PlannedBlockForPrintable,
  b: PlannedBlockForPrintable,
): number {
  return a.startHHmm.localeCompare(b.startHHmm);
}

/**
 * Build the photo-submit deeplink for a given block on a given date.
 *
 * The downstream surface is a server route that resolves the block +
 * date + photo upload. Idempotent on its own; this helper just composes
 * the URL.
 */
export function buildSubmitDeeplink(
  submitBaseUrl: string,
  blockId: string,
  dateIso: string,
): string {
  const trimmed = submitBaseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({ blockId, date: dateIso });
  return `${trimmed}/api/scheduled/worksheet-photo-submit?${params.toString()}`;
}

export function planPrintableDailyBundle(
  input: PrintableBundleInput,
): PrintableBundleOutcome {
  if (!ISO_DATE.test(input.dateIso)) {
    return { kind: "blocked", reason: "bad-date" };
  }
  if (!input.submitBaseUrl || input.submitBaseUrl.trim().length === 0) {
    return { kind: "blocked", reason: "missing-submit-base-url" };
  }
  if (!/^https:\/\//i.test(input.submitBaseUrl)) {
    return { kind: "blocked", reason: "submit-base-url-not-https" };
  }

  // Drop Slay Charge ⚡ and any other morning_vibe blocks — they are not
  // assignments, must never print on the daily worksheet bundle.
  const printableBlocks = input.blocks
    .filter((b) => b.type !== "morning_vibe" && b.type !== "morning_warmup")
    .filter((b) => HHMM.test(b.startHHmm))
    .filter((b) => Number.isFinite(b.durationMin) && b.durationMin > 0)
    .slice()
    .sort(compareBlocksByStart);

  if (printableBlocks.length === 0) {
    return { kind: "blocked", reason: "no-printable-blocks" };
  }

  const sections: PrintableSection[] = [];

  sections.push({
    kind: "cover",
    sectionId: "cover",
    title: `Daily Schedule — ${input.dateIso}${
      input.tutorOfDayName ? ` (with ${input.tutorOfDayName})` : ""
    }`,
  });

  sections.push({
    kind: "schedule-overview",
    sectionId: "schedule-overview",
    title: "Today's blocks at a glance",
  });

  for (const block of printableBlocks) {
    sections.push({
      kind: "block-page",
      sectionId: `block:${block.blockId}`,
      title: `${block.startHHmm} — ${block.title}`,
      blockId: block.blockId,
      pdfKey: block.lessonPdfKey,
    });

    if (block.worksheetPdfKey) {
      sections.push({
        kind: "worksheet",
        sectionId: `worksheet:${block.blockId}`,
        title: `${block.title} — Worksheet`,
        blockId: block.blockId,
        pdfKey: block.worksheetPdfKey,
        submitDeeplink: buildSubmitDeeplink(
          input.submitBaseUrl,
          block.blockId,
          input.dateIso,
        ),
      });
    }

    if (block.answerKeyPdfKey && input.audienceTier === "adult") {
      sections.push({
        kind: "answer-key-adult",
        sectionId: `answer-key:${block.blockId}`,
        title: `${block.title} — Answer Key (adult)`,
        blockId: block.blockId,
        pdfKey: block.answerKeyPdfKey,
      });
    }
  }

  sections.push({
    kind: "submit-instructions",
    sectionId: "submit-instructions",
    title: "Done? Snap a photo to submit",
  });

  const footerLine = `Reagan's Homeschool Dashboard — ${input.dateIso}${
    input.audienceTier === "adult" ? " (adult copy)" : ""
  }`;

  return { kind: "ready", sections, footerLine };
}
