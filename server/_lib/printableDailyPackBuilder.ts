/**
 * Wave-15 / Push 208 — printableDailyPackBuilder
 *
 * Pure deterministic helper. Given today's agenda blocks (already
 * fetched + resolved upstream), returns a structured "printable pack"
 * description the UI can hand to a print template / PDF route so the
 * adult can hit the Homepage "Printable" button and get:
 *
 *   1. A one-page schedule view (today's blocks + estimated minutes)
 *   2. A worksheet list (PDF links / page refs already on the block)
 *   3. A lesson list (PDF links for read-alouds / lessons)
 *   4. A handoff note for the day's tutor (calm voice — never punitive)
 *
 * This helper does NOT generate PDFs itself. It returns the structured
 * pack so the route / client can render a print-friendly HTML view or
 * fan out to PDF tooling. Keeping this side-effect-free makes it cheap
 * to vitest and safe to call from anywhere.
 *
 * House rules baked in:
 *   - Never punitive. Tutor handoff line never says "behind" or
 *     "didn't do" — it says "still on the plate" if a block isn't done.
 *   - Reagan-safe printables: worksheet entries always include the
 *     printedBookRef (page number) when present so we honor her
 *     existing printed copies (Tuck Everlasting, Michael's World,
 *     Spectrum Science Grade 5, 180 Days of Language).
 *   - Voice: calm older-cousin tone for the kidNote line on the
 *     schedule header. No "buddy / friend / yay / great job!".
 *   - Time estimates are *suggested*, never enforced. The print header
 *     always notes "estimated, not enforced" so timing pressure stays
 *     off Reagan's plate.
 */

export type AgendaBlockStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "skipped";

export interface AgendaBlockForPack {
  id: number;
  title: string;
  subjectSlug?: string | null;
  status: AgendaBlockStatus;
  estimatedMinutes?: number | null;
  worksheetPdfUrl?: string | null;
  worksheetPdfName?: string | null;
  lessonPdfUrl?: string | null;
  lessonPdfName?: string | null;
  /**
   * If a block references a printed book Reagan already owns, the
   * upstream code passes through { book, pages } so the print pack can
   * say "Tuck Everlasting — pg 47-52" instead of forcing a digital PDF.
   */
  printedBookRef?: {
    book: string;
    pages: string;
  } | null;
  notes?: string | null;
}

export interface PrintableDailyPack {
  isoDate: string;
  scheduleHeader: {
    title: string;
    kidNote: string;
    adultNote: string;
    estimatedTotalMinutes: number;
  };
  scheduleRows: Array<{
    blockId: number;
    title: string;
    subjectSlug: string | null;
    status: AgendaBlockStatus;
    estimatedMinutes: number | null;
    printedBookLine: string | null;
  }>;
  worksheetList: Array<{
    blockId: number;
    blockTitle: string;
    label: string;
    href: string | null;
    printedBookLine: string | null;
  }>;
  lessonList: Array<{
    blockId: number;
    blockTitle: string;
    label: string;
    href: string | null;
  }>;
  tutorHandoff: {
    summaryLine: string;
    stillOnPlate: string[];
    notesForTutor: string[];
  };
}

const FORBIDDEN_TUTOR_PHRASES = /behind|didn'?t do|failed|fell short/i;

function clampMinutes(n: number | null | undefined): number | null {
  if (n == null) return null;
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 240) return 240;
  return Math.round(n);
}

function safeBlockTitle(title: string | null | undefined): string {
  const t = (title ?? "").trim();
  return t.length > 0 ? t : "Untitled block";
}

export function buildPrintableDailyPack(input: {
  isoDate: string;
  blocks: AgendaBlockForPack[];
  tutorName?: string | null;
}): PrintableDailyPack {
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];

  const scheduleRows = blocks.map((b) => {
    const printedBookLine = b.printedBookRef
      ? `${b.printedBookRef.book} — pg ${b.printedBookRef.pages}`
      : null;
    return {
      blockId: b.id,
      title: safeBlockTitle(b.title),
      subjectSlug: b.subjectSlug ?? null,
      status: b.status,
      estimatedMinutes: clampMinutes(b.estimatedMinutes),
      printedBookLine,
    };
  });

  const estimatedTotalMinutes = scheduleRows.reduce(
    (acc, r) => acc + (r.estimatedMinutes ?? 0),
    0,
  );

  const worksheetList = blocks
    .filter((b) => b.worksheetPdfUrl || b.printedBookRef)
    .map((b) => {
      const printedBookLine = b.printedBookRef
        ? `${b.printedBookRef.book} — pg ${b.printedBookRef.pages}`
        : null;
      const label =
        b.worksheetPdfName ??
        (printedBookLine ? `${b.title} (printed)` : `${b.title} worksheet`);
      return {
        blockId: b.id,
        blockTitle: safeBlockTitle(b.title),
        label,
        href: b.worksheetPdfUrl ?? null,
        printedBookLine,
      };
    });

  const lessonList = blocks
    .filter((b) => b.lessonPdfUrl)
    .map((b) => ({
      blockId: b.id,
      blockTitle: safeBlockTitle(b.title),
      label: b.lessonPdfName ?? `${b.title} lesson`,
      href: b.lessonPdfUrl ?? null,
    }));

  const stillOnPlate = blocks
    .filter(
      (b) => b.status === "not_started" || b.status === "in_progress",
    )
    .map((b) => safeBlockTitle(b.title));

  const notesForTutor = blocks
    .map((b) => (b.notes ?? "").trim())
    .filter((n) => n.length > 0)
    .filter((n) => !FORBIDDEN_TUTOR_PHRASES.test(n));

  const tutorLabel = input.tutorName
    ? `Tutor on duty: ${input.tutorName}.`
    : "No tutor assigned today.";

  const summaryLine = stillOnPlate.length
    ? `${tutorLabel} ${stillOnPlate.length} block${stillOnPlate.length === 1 ? "" : "s"} still on the plate.`
    : `${tutorLabel} Plate is clear.`;

  return {
    isoDate: input.isoDate,
    scheduleHeader: {
      title: `Today — ${input.isoDate}`,
      kidNote: "Times are a guess. Take what you need.",
      adultNote:
        "Estimated minutes are suggestions, not enforced. Honor Reagan's pace.",
      estimatedTotalMinutes,
    },
    scheduleRows,
    worksheetList,
    lessonList,
    tutorHandoff: {
      summaryLine,
      stillOnPlate,
      notesForTutor,
    },
  };
}
