/**
 * Push 179 (2026-05-14, Wave-13) — Bookshelf milestone celebration helper.
 *
 * Pure helper. Given the latest bookshelf rollup (printed-book progress)
 * + the prior-day rollup, emits at most ONE kid-readable celebration
 * headline + an adult-side log entry suitable for the Drive day log.
 *
 * Celebration triggers (ordered by priority, first-match wins):
 *   1) Finished a book (chaptersRead == totalChapters and prior < total)
 *   2) Crossed a quarter (25 / 50 / 75 %) for the first time
 *   3) Read at least 3 chapters today across all books
 *   4) Returned to a book after >= 7-day gap and read >= 1 chapter
 *
 * Anti-pattern guards:
 *   - never says "good job" / "you did great" robotically — uses specific facts
 *   - never compares to other kids
 *   - never mentions grades, points, scores, or "behind"
 *   - if no real progress, returns no celebration (notice = false)
 */

export interface BookshelfBookSnapshot {
  bookId: string;
  title: string;
  chaptersRead: number;
  totalChapters: number;
  /** ISO date of the most recent chapter read for this book, or null. */
  lastReadISO?: string | null;
}

export interface BookshelfMilestoneInput {
  todayISO: string;
  todaySnapshot: BookshelfBookSnapshot[];
  yesterdaySnapshot?: BookshelfBookSnapshot[] | null;
  kidName?: string;
}

export interface BookshelfMilestoneResult {
  notice: boolean;
  /** A single kid-readable line. Empty when notice = false. */
  kidLine: string;
  /** A short adult-side log entry suitable for the Drive day log. */
  adultLogEntry: string;
  trigger:
    | "none"
    | "finished_book"
    | "quarter_crossed"
    | "three_today"
    | "returned_after_gap";
  /** Stable id used by callers to dedupe — same input => same id. */
  celebrationId: string | null;
}

function isISO(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function pctOf(read: number, total: number): number {
  if (total <= 0) return 0;
  return Math.floor((read / total) * 100);
}

function quarterCrossed(prior: number, now: number): 25 | 50 | 75 | null {
  for (const q of [75, 50, 25] as const) {
    if (now >= q && prior < q) return q;
  }
  return null;
}

function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T00:00:00Z`).getTime();
  const b = new Date(`${bISO}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function computeBookshelfMilestone(
  input: BookshelfMilestoneInput,
): BookshelfMilestoneResult {
  if (!isISO(input.todayISO)) {
    throw new Error(
      `[bookshelfMilestoneCelebration] todayISO must be YYYY-MM-DD; got ${String(input.todayISO)}`,
    );
  }
  const today = input.todaySnapshot ?? [];
  const yesterday = input.yesterdaySnapshot ?? [];
  const yMap = new Map<string, BookshelfBookSnapshot>();
  for (const b of yesterday) yMap.set(b.bookId, b);

  const empty: BookshelfMilestoneResult = {
    notice: false,
    kidLine: "",
    adultLogEntry: "",
    trigger: "none",
    celebrationId: null,
  };
  if (today.length === 0) return empty;

  // 1) Finished a book today
  for (const t of today) {
    const y = yMap.get(t.bookId);
    const yRead = y?.chaptersRead ?? 0;
    if (
      t.totalChapters > 0 &&
      t.chaptersRead === t.totalChapters &&
      yRead < t.totalChapters
    ) {
      return {
        notice: true,
        kidLine: `You finished “${t.title}.” Whoa.`,
        adultLogEntry: `Reagan finished ${t.title} on ${input.todayISO} (${t.totalChapters} chapters total).`,
        trigger: "finished_book",
        celebrationId: `finished:${t.bookId}:${input.todayISO}`,
      };
    }
  }

  // 2) Quarter crossed today (highest quarter wins)
  let bestQuarter:
    | { q: 25 | 50 | 75; book: BookshelfBookSnapshot }
    | null = null;
  for (const t of today) {
    const y = yMap.get(t.bookId);
    const yPct = pctOf(y?.chaptersRead ?? 0, y?.totalChapters ?? t.totalChapters);
    const tPct = pctOf(t.chaptersRead, t.totalChapters);
    const q = quarterCrossed(yPct, tPct);
    if (q && (!bestQuarter || q > bestQuarter.q)) {
      bestQuarter = { q, book: t };
    }
  }
  if (bestQuarter) {
    const { q, book } = bestQuarter;
    return {
      notice: true,
      kidLine: `You're ${q}% of the way through “${book.title}.” Nice steady reading.`,
      adultLogEntry: `Reagan crossed ${q}% on ${book.title} (${book.chaptersRead}/${book.totalChapters}) on ${input.todayISO}.`,
      trigger: "quarter_crossed",
      celebrationId: `quarter:${book.bookId}:${q}:${input.todayISO}`,
    };
  }

  // 3) Three or more chapters read across all books today
  let chaptersToday = 0;
  for (const t of today) {
    const y = yMap.get(t.bookId);
    chaptersToday += Math.max(0, t.chaptersRead - (y?.chaptersRead ?? 0));
  }
  if (chaptersToday >= 3) {
    return {
      notice: true,
      kidLine: `${chaptersToday} chapters today. That's a strong reading day.`,
      adultLogEntry: `Reagan read ${chaptersToday} chapters across the bookshelf on ${input.todayISO}.`,
      trigger: "three_today",
      celebrationId: `three:${chaptersToday}:${input.todayISO}`,
    };
  }

  // 4) Returned to a book after >= 7-day gap
  for (const t of today) {
    const y = yMap.get(t.bookId);
    const todayProgress = t.chaptersRead - (y?.chaptersRead ?? 0);
    if (todayProgress < 1) continue;
    if (!t.lastReadISO || !y?.lastReadISO) continue;
    // y.lastReadISO is the prior reading date BEFORE today's read; t.lastReadISO is today
    const gap = daysBetween(input.todayISO, y.lastReadISO);
    if (gap >= 7) {
      return {
        notice: true,
        kidLine: `You picked “${t.title}” back up. Welcome back to the story.`,
        adultLogEntry: `Reagan returned to ${t.title} after a ${gap}-day gap on ${input.todayISO} (read ${todayProgress} chapter${todayProgress === 1 ? "" : "s"}).`,
        trigger: "returned_after_gap",
        celebrationId: `return:${t.bookId}:${input.todayISO}`,
      };
    }
  }

  return empty;
}
