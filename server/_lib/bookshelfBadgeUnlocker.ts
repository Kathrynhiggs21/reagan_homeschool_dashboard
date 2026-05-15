/**
 * Wave-15 / Push 198 — bookshelfBadgeUnlocker
 *
 * PURE deterministic helper. Lifetime BooksFinished + the latest event
 * → which (if any) badges are newly unlocked. Each badge unlocks AT MOST
 * once per lifetime; `alreadyUnlockedBadgeKeys` is the gate. Always
 * celebratory, never punitive. Adults notified only on milestone tiers.
 */

export interface BookFinishEvent {
  title: string;
  isoDate: string;
  seriesKey?: string | null;
  isChapterBook?: boolean;
}

export interface BadgeDefinition {
  key: string;
  label: string;
  emoji: string;
  category: "milestone" | "streak" | "series" | "chapter";
}

export interface UnlockerInput {
  history: BookFinishEvent[];
  latest: BookFinishEvent;
  isoDateLocal: string;
  alreadyUnlockedBadgeKeys: string[];
}

export interface BadgeUnlock {
  badge: BadgeDefinition;
  kidHeadline: string;
  notifyPayload:
    | {
        category: "bookshelf_milestone";
        title: string;
        content: string;
      }
    | null;
}

export interface UnlockerResult {
  unlockedNow: BadgeUnlock[];
  totalBooksLifetime: number;
  currentStreakDays: number;
}

const MILESTONE_TIERS: { count: number; key: string; label: string }[] = [
  { count: 1, key: "first_book", label: "First book finished" },
  { count: 5, key: "five_books", label: "5 books on the shelf" },
  { count: 10, key: "ten_books", label: "10 books club" },
  { count: 25, key: "twenty_five_books", label: "25 books — quarter-century" },
  { count: 50, key: "fifty_books", label: "50 books — half-century" },
  { count: 100, key: "hundred_books", label: "100 books — a real reader" },
];

function isoMinusOneDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function streakDays(history: BookFinishEvent[], isoDateLocal: string): number {
  const dates = new Set(history.map((b) => b.isoDate));
  let cursor = isoDateLocal;
  let days = 0;
  for (let i = 0; i < 1000; i++) {
    if (!dates.has(cursor)) break;
    days++;
    cursor = isoMinusOneDay(cursor);
  }
  return days;
}

function chapterBooksCount(history: BookFinishEvent[]): number {
  return history.filter((b) => b.isChapterBook).length;
}

function seriesCount(history: BookFinishEvent[], seriesKey: string): number {
  return history.filter((b) => b.seriesKey === seriesKey).length;
}

export function unlockBadges(input: UnlockerInput): UnlockerResult {
  const already = new Set(input.alreadyUnlockedBadgeKeys);
  const unlocked: BadgeUnlock[] = [];
  const total = input.history.length;
  const streak = streakDays(input.history, input.isoDateLocal);

  for (const tier of MILESTONE_TIERS) {
    if (total >= tier.count && !already.has(tier.key)) {
      unlocked.push({
        badge: { key: tier.key, label: tier.label, emoji: "📚", category: "milestone" },
        kidHeadline: `Whoa — ${tier.label}! You're growing into a real reader.`,
        notifyPayload: {
          category: "bookshelf_milestone",
          title: `Reagan unlocked: ${tier.label}`,
          content: `Reagan just finished "${input.latest.title}" — that's book #${total} on her lifetime shelf.`,
        },
      });
    }
  }

  const streakTiers = [
    { days: 3, key: "streak_3", label: "3-day reading streak" },
    { days: 7, key: "streak_7", label: "7-day reading streak" },
    { days: 14, key: "streak_14", label: "14-day reading streak" },
    { days: 30, key: "streak_30", label: "30-day reading streak" },
  ];
  for (const tier of streakTiers) {
    if (streak >= tier.days && !already.has(tier.key)) {
      unlocked.push({
        badge: { key: tier.key, label: tier.label, emoji: "🔥", category: "streak" },
        kidHeadline: `${tier.days} days of reading in a row — you're on fire!`,
        notifyPayload: null,
      });
    }
  }

  const chapters = chapterBooksCount(input.history);
  const chapterTiers = [
    { count: 1, key: "first_chapter_book", label: "First chapter book" },
    { count: 5, key: "five_chapter_books", label: "5 chapter books" },
    { count: 10, key: "ten_chapter_books", label: "10 chapter books" },
  ];
  for (const tier of chapterTiers) {
    if (chapters >= tier.count && !already.has(tier.key)) {
      unlocked.push({
        badge: { key: tier.key, label: tier.label, emoji: "📖", category: "chapter" },
        kidHeadline: `${tier.label}! Big-kid books for the win.`,
        notifyPayload:
          tier.count === 1
            ? {
                category: "bookshelf_milestone",
                title: "Reagan finished her first chapter book",
                content: `"${input.latest.title}" — first chapter book on the shelf!`,
              }
            : null,
      });
    }
  }

  if (input.latest.seriesKey) {
    const sCount = seriesCount(input.history, input.latest.seriesKey);
    const seriesTiers = [
      { count: 3, suffix: "_3", label: "3 books in the series" },
      { count: 5, suffix: "_5", label: "5 books in the series" },
    ];
    for (const tier of seriesTiers) {
      const key = `series_${input.latest.seriesKey}${tier.suffix}`;
      if (sCount >= tier.count && !already.has(key)) {
        unlocked.push({
          badge: {
            key,
            label: `${input.latest.seriesKey}: ${tier.label}`,
            emoji: "🏅",
            category: "series",
          },
          kidHeadline: `${tier.count} books from the same series — you found your people!`,
          notifyPayload: null,
        });
      }
    }
  }

  return { unlockedNow: unlocked, totalBooksLifetime: total, currentStreakDays: streak };
}

export const __FOR_TEST__ = {
  MILESTONE_TIERS,
  streakDays,
  isoMinusOneDay,
  chapterBooksCount,
  seriesCount,
};
