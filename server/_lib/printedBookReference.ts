/**
 * Push 139 (2026-05-13) — Printed-book page reference pure helper.
 *
 * Project rule: when assigning tasks to Reagan, prefer her existing
 * printed copies. The four canonical books on the shelf are:
 *   1. Tuck Everlasting (literature, ~140 pages, chapter-paced)
 *   2. Michael's World (literature, ~120 pages, chapter-paced)
 *   3. Spectrum Science Grade 5 (workbook, ~150 pages, page-paced)
 *   4. 180 Days of Language for 5th Grade (workbook, 180 day-pages,
 *      day-paced — 1 day-page per school day)
 *
 * The agenda generator and AI Agenda Editor call this helper to format
 * a canonical "read pg X–Y" or "complete pg N" string and to validate
 * that the page range exists in the book. The Curriculum Hub uses the
 * same helper to surface "this assignment is on pg 14".
 *
 * Pure module — no DB, no I/O. The four book entries are the single
 * source of truth (project rule); titles and pacing live here so the
 * digest, recap email, and printable schedule all read consistently.
 */

export type PrintedBookSlug =
  | "tuck-everlasting"
  | "michaels-world"
  | "spectrum-science-5"
  | "180-days-language-5";

export type PrintedBookKind = "literature" | "workbook" | "day-paced-workbook";

export interface PrintedBookEntry {
  slug: PrintedBookSlug;
  title: string;
  kind: PrintedBookKind;
  totalPages: number;
  /** "read" for literature, "complete" for workbooks. */
  verb: "read" | "complete";
}

export const PRINTED_BOOK_SHELF: ReadonlyArray<PrintedBookEntry> = [
  {
    slug: "tuck-everlasting",
    title: "Tuck Everlasting",
    kind: "literature",
    totalPages: 140,
    verb: "read",
  },
  {
    slug: "michaels-world",
    title: "Michael's World",
    kind: "literature",
    totalPages: 120,
    verb: "read",
  },
  {
    slug: "spectrum-science-5",
    title: "Spectrum Science Grade 5",
    kind: "workbook",
    totalPages: 150,
    verb: "complete",
  },
  {
    slug: "180-days-language-5",
    title: "180 Days of Language for 5th Grade",
    kind: "day-paced-workbook",
    totalPages: 180,
    verb: "complete",
  },
];

const SHELF_BY_SLUG = new Map<PrintedBookSlug, PrintedBookEntry>(
  PRINTED_BOOK_SHELF.map((b) => [b.slug, b]),
);

export type PrintedBookReferenceResult =
  | {
      ok: true;
      book: PrintedBookEntry;
      label: string;
      /** Inclusive start, inclusive end (single-page when start === end). */
      startPage: number;
      endPage: number;
      /** True when the helper formatted a single page (e.g. "pg 14"). */
      singlePage: boolean;
    }
  | {
      ok: false;
      rejectReason:
        | "unknown-book"
        | "non-finite-page"
        | "page-out-of-range"
        | "end-before-start";
    };

function isPositiveInt(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isFinite(n) &&
    Number.isInteger(n) &&
    n >= 1
  );
}

export function lookupPrintedBook(
  slug: PrintedBookSlug | string,
): PrintedBookEntry | undefined {
  return SHELF_BY_SLUG.get(slug as PrintedBookSlug);
}

export function buildPrintedBookReference(input: {
  slug: PrintedBookSlug | string;
  startPage: number;
  endPage?: number;
}): PrintedBookReferenceResult {
  const book = lookupPrintedBook(input.slug);
  if (!book) return { ok: false, rejectReason: "unknown-book" };
  if (!isPositiveInt(input.startPage)) {
    return { ok: false, rejectReason: "non-finite-page" };
  }
  const endRaw = input.endPage ?? input.startPage;
  if (!isPositiveInt(endRaw)) {
    return { ok: false, rejectReason: "non-finite-page" };
  }
  if (endRaw < input.startPage) {
    return { ok: false, rejectReason: "end-before-start" };
  }
  if (input.startPage > book.totalPages || endRaw > book.totalPages) {
    return { ok: false, rejectReason: "page-out-of-range" };
  }

  const single = endRaw === input.startPage;
  // Canonical wording per project rule: "read pg X–Y" / "complete pg N".
  const range = single ? `pg ${input.startPage}` : `pg ${input.startPage}–${endRaw}`;
  const label = `${book.verb} ${range} of ${book.title}`;
  return {
    ok: true,
    book,
    label,
    startPage: input.startPage,
    endPage: endRaw,
    singlePage: single,
  };
}

/**
 * Day-paced workbooks (180 Days of Language) have one day-page per
 * school day; this helper picks the right page for the n-th school day
 * (1-indexed) and falls back to a clean rejection when n is out of
 * range. School-year start date is not encoded here — the caller passes
 * the school-day index it has computed elsewhere.
 */
export function pickDayPagedWorkbookReference(input: {
  slug: PrintedBookSlug | string;
  schoolDayIndex: number;
}): PrintedBookReferenceResult {
  const book = lookupPrintedBook(input.slug);
  if (!book) return { ok: false, rejectReason: "unknown-book" };
  if (book.kind !== "day-paced-workbook") {
    // Caller used the wrong helper — surface as unknown-book so callers
    // never silently fall through to the wrong pacing.
    return { ok: false, rejectReason: "unknown-book" };
  }
  if (!isPositiveInt(input.schoolDayIndex)) {
    return { ok: false, rejectReason: "non-finite-page" };
  }
  if (input.schoolDayIndex > book.totalPages) {
    return { ok: false, rejectReason: "page-out-of-range" };
  }
  return buildPrintedBookReference({
    slug: book.slug,
    startPage: input.schoolDayIndex,
  });
}
