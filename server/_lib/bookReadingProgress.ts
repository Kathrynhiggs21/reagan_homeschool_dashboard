/**
 * Push 140 (2026-05-14) — Book-reading progress tracker pure helper.
 *
 * Tracks Reagan's progress through the four canonical printed shelf books
 * (see Push 139 — printedBookReference). Given the prior highest page and
 * a logged session, returns the new monotonic high-water mark and a
 * completion summary that the bookshelf UI / digest / recap can render.
 *
 * Distinguishes:
 *   - literature ("read") — Tuck Everlasting, Michael's World
 *   - workbook ("complete") — Spectrum Science 5
 *   - day-paced-workbook — 180 Days of Language 5 (1 page = 1 school day)
 *
 * Pure module: no DB / no I/O. Single source of truth for the book
 * registry stays in printedBookReference.ts.
 */
import {
  PRINTED_BOOK_SHELF,
  lookupPrintedBook,
  type PrintedBookEntry,
  type PrintedBookSlug,
} from "./printedBookReference";

export type BookReadingRejectReason =
  | "unknown-book"
  | "missing-page-data"
  | "page-out-of-range"
  | "invalid-page-range"
  | "invalid-day-number"
  | "no-progress-recorded";

export type BookReadingSessionInput = {
  slug: PrintedBookSlug | string;
  startPage?: number | null;
  endPage?: number | null;
  /** For day-paced workbooks: which school day was completed. 1-indexed. */
  dayNumber?: number | null;
};

export type BookReadingProgressInput = {
  /** Caller's prior best (highest page reached). null/undef/<0 → 0. */
  priorHighestPage?: number | null;
  session: BookReadingSessionInput;
};

export type BookReadingProgressOk = {
  ok: true;
  book: PrintedBookEntry;
  totalPages: number;
  newHighestPage: number;
  pagesReadThisSession: number;
  pagesRemaining: number;
  /** 0..1 */
  completionRatio: number;
  /** 0..100, rounded */
  completionPercent: number;
  isComplete: boolean;
  /** True when this session pushed the high-water mark forward. */
  advanced: boolean;
  resolvedRange: { startPage: number; endPage: number };
};

export type BookReadingProgressErr = {
  ok: false;
  rejectReason: BookReadingRejectReason;
  message: string;
};

export type BookReadingProgressResult =
  | BookReadingProgressOk
  | BookReadingProgressErr;

function isFiniteInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && Number.isInteger(n);
}

function clampNonNeg(n: number | null | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function applyBookReadingSession(
  input: BookReadingProgressInput,
): BookReadingProgressResult {
  const book = lookupPrintedBook(input.session.slug);
  if (!book) {
    return {
      ok: false,
      rejectReason: "unknown-book",
      message: `Book "${input.session.slug}" is not on the canonical shelf.`,
    };
  }

  const totalPages = book.totalPages;
  let startPage: number;
  let endPage: number;

  // Day-paced workbook fast path: dayNumber → page = dayNumber
  if (
    book.kind === "day-paced-workbook" &&
    input.session.dayNumber !== undefined &&
    input.session.dayNumber !== null
  ) {
    const day = input.session.dayNumber;
    if (!isFiniteInt(day) || day < 1 || day > totalPages) {
      return {
        ok: false,
        rejectReason: "invalid-day-number",
        message: `Day ${day} is outside 1..${totalPages}.`,
      };
    }
    startPage = day;
    endPage = day;
  } else {
    const rawStart = input.session.startPage;
    const rawEnd = input.session.endPage;
    if (
      rawStart === null ||
      rawStart === undefined ||
      rawEnd === null ||
      rawEnd === undefined
    ) {
      return {
        ok: false,
        rejectReason: "missing-page-data",
        message:
          "startPage + endPage required (or dayNumber for day-paced workbooks).",
      };
    }
    if (!isFiniteInt(rawStart) || !isFiniteInt(rawEnd)) {
      return {
        ok: false,
        rejectReason: "missing-page-data",
        message: "startPage and endPage must be whole numbers.",
      };
    }
    if (rawStart < 1 || rawEnd < 1) {
      return {
        ok: false,
        rejectReason: "page-out-of-range",
        message: `Pages must be ≥ 1.`,
      };
    }
    if (rawStart > totalPages || rawEnd > totalPages) {
      return {
        ok: false,
        rejectReason: "page-out-of-range",
        message: `Pages must be within 1..${totalPages} for "${book.title}".`,
      };
    }
    if (rawEnd < rawStart) {
      return {
        ok: false,
        rejectReason: "invalid-page-range",
        message: `endPage (${rawEnd}) must be ≥ startPage (${rawStart}).`,
      };
    }
    startPage = rawStart;
    endPage = rawEnd;
  }

  const prior = clampNonNeg(input.priorHighestPage);
  const cappedPrior = Math.min(prior, totalPages);
  const newHighest = Math.max(cappedPrior, endPage);
  const advanced = newHighest > cappedPrior;

  // Re-reading after completion is a no-op signal (kid already finished).
  if (!advanced && cappedPrior >= totalPages) {
    return {
      ok: false,
      rejectReason: "no-progress-recorded",
      message: `"${book.title}" already complete; nothing new logged.`,
    };
  }

  const ratio = newHighest / totalPages;
  return {
    ok: true,
    book,
    totalPages,
    newHighestPage: newHighest,
    pagesReadThisSession: endPage - startPage + 1,
    pagesRemaining: Math.max(0, totalPages - newHighest),
    completionRatio: Math.min(1, Math.max(0, ratio)),
    completionPercent: Math.min(100, Math.max(0, Math.round(ratio * 100))),
    isComplete: newHighest >= totalPages,
    advanced,
    resolvedRange: { startPage, endPage },
  };
}

/**
 * Roll up multiple sessions across the whole shelf for the bookshelf UI.
 * Invalid sessions are skipped silently so a single bad row never tanks
 * the kid-facing progress card.
 */
export function rollupShelfProgress(
  prior: Record<string, number | null | undefined>,
  sessions: BookReadingSessionInput[] | null | undefined,
): Array<{
  slug: PrintedBookSlug;
  title: string;
  newHighestPage: number;
  totalPages: number;
  completionPercent: number;
  isComplete: boolean;
}> {
  const next: Record<string, number> = {};
  for (const book of PRINTED_BOOK_SHELF) {
    next[book.slug] = Math.min(book.totalPages, clampNonNeg(prior?.[book.slug]));
  }
  if (Array.isArray(sessions)) {
    for (const s of sessions) {
      if (!s || typeof s !== "object") continue;
      const r = applyBookReadingSession({
        priorHighestPage: next[s.slug] ?? 0,
        session: s,
      });
      if (r.ok) next[r.book.slug] = r.newHighestPage;
    }
  }
  return PRINTED_BOOK_SHELF.map((b) => {
    const high = next[b.slug] ?? 0;
    const ratio = high / b.totalPages;
    return {
      slug: b.slug,
      title: b.title,
      newHighestPage: high,
      totalPages: b.totalPages,
      completionPercent: Math.min(100, Math.max(0, Math.round(ratio * 100))),
      isComplete: high >= b.totalPages,
    };
  });
}
