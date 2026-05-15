import { describe, it, expect } from "vitest";
import {
  unlockBadges,
  __FOR_TEST__,
  type BookFinishEvent,
  type UnlockerInput,
} from "./_lib/bookshelfBadgeUnlocker";

const TODAY = "2026-05-14";

function b(
  title: string,
  isoDate: string,
  over: Partial<BookFinishEvent> = {},
): BookFinishEvent {
  return { title, isoDate, ...over };
}

function input(over: Partial<UnlockerInput> = {}): UnlockerInput {
  return {
    history: [],
    latest: b("Frog and Toad", TODAY),
    isoDateLocal: TODAY,
    alreadyUnlockedBadgeKeys: [],
    ...over,
  };
}

describe("Push 198 — bookshelfBadgeUnlocker", () => {
  it("first finished book unlocks first_book + has adult notify", () => {
    const r = unlockBadges(input({ history: [b("Frog and Toad", TODAY)] }));
    expect(r.totalBooksLifetime).toBe(1);
    const keys = r.unlockedNow.map((u) => u.badge.key);
    expect(keys).toContain("first_book");
    const fb = r.unlockedNow.find((u) => u.badge.key === "first_book")!;
    expect(fb.notifyPayload?.category).toBe("bookshelf_milestone");
    expect(fb.notifyPayload?.content).toContain("Frog and Toad");
  });

  it("milestone already unlocked is NOT re-emitted", () => {
    const r = unlockBadges(
      input({
        history: [b("Frog and Toad", TODAY)],
        alreadyUnlockedBadgeKeys: ["first_book"],
      }),
    );
    const keys = r.unlockedNow.map((u) => u.badge.key);
    expect(keys).not.toContain("first_book");
  });

  it("crossing 5 books unlocks five_books", () => {
    const history = Array.from({ length: 5 }, (_, i) =>
      b(`Book ${i + 1}`, "2026-05-1" + (i % 10)),
    );
    const r = unlockBadges(
      input({ history, alreadyUnlockedBadgeKeys: ["first_book"] }),
    );
    expect(r.unlockedNow.map((u) => u.badge.key)).toContain("five_books");
  });

  it("crossing 10 + 25 lights up ALL still-locked milestone tiers", () => {
    const history = Array.from({ length: 25 }, (_, i) =>
      b(`Book ${i + 1}`, "2026-05-1" + (i % 10)),
    );
    const r = unlockBadges(input({ history, alreadyUnlockedBadgeKeys: [] }));
    const keys = r.unlockedNow.map((u) => u.badge.key);
    expect(keys).toContain("first_book");
    expect(keys).toContain("five_books");
    expect(keys).toContain("ten_books");
    expect(keys).toContain("twenty_five_books");
    expect(keys).not.toContain("fifty_books");
  });

  it("streak counts back-to-back days from isoDateLocal", () => {
    const history = [
      b("A", "2026-05-12"),
      b("B", "2026-05-13"),
      b("C", "2026-05-14"),
    ];
    const r = unlockBadges(input({ history }));
    expect(r.currentStreakDays).toBe(3);
    expect(r.unlockedNow.map((u) => u.badge.key)).toContain("streak_3");
  });

  it("a gap breaks the streak", () => {
    const history = [
      b("A", "2026-05-10"),
      b("B", "2026-05-12"),
      b("C", "2026-05-14"),
    ];
    const r = unlockBadges(input({ history }));
    expect(r.currentStreakDays).toBe(1);
  });

  it("chapter book counts unlock the chapter tiers", () => {
    const history = Array.from({ length: 5 }, (_, i) =>
      b(`Chap ${i + 1}`, "2026-05-1" + (i % 10), { isChapterBook: true }),
    );
    const r = unlockBadges(input({ history }));
    const keys = r.unlockedNow.map((u) => u.badge.key);
    expect(keys).toContain("first_chapter_book");
    expect(keys).toContain("five_chapter_books");
  });

  it("first_chapter_book has adult notify, later chapter tiers do not", () => {
    const history = Array.from({ length: 5 }, (_, i) =>
      b(`Chap ${i + 1}`, "2026-05-1" + (i % 10), { isChapterBook: true }),
    );
    const r = unlockBadges(input({ history }));
    const fc = r.unlockedNow.find((u) => u.badge.key === "first_chapter_book")!;
    const fiveC = r.unlockedNow.find((u) => u.badge.key === "five_chapter_books")!;
    expect(fc.notifyPayload?.category).toBe("bookshelf_milestone");
    expect(fiveC.notifyPayload).toBeNull();
  });

  it("series badges only fire when latest event has a seriesKey", () => {
    const history = [
      b("Magic Tree A", "2026-05-12", { seriesKey: "magic_tree_house" }),
      b("Magic Tree B", "2026-05-13", { seriesKey: "magic_tree_house" }),
      b("Magic Tree C", "2026-05-14", { seriesKey: "magic_tree_house" }),
    ];
    const r = unlockBadges(input({ history, latest: history[2] }));
    expect(
      r.unlockedNow.some((u) => u.badge.key === "series_magic_tree_house_3"),
    ).toBe(true);
  });

  it("series badges do NOT fire when latest event has no seriesKey", () => {
    const history = [
      b("Magic Tree A", "2026-05-12", { seriesKey: "magic_tree_house" }),
      b("Magic Tree B", "2026-05-13", { seriesKey: "magic_tree_house" }),
      b("Standalone", "2026-05-14"),
    ];
    const r = unlockBadges(input({ history, latest: history[2] }));
    expect(
      r.unlockedNow.some((u) => u.badge.key.startsWith("series_")),
    ).toBe(false);
  });

  it("streak unlocks have notifyPayload=null (kid celebrates, adult doesn't get pinged)", () => {
    const history = [
      b("A", "2026-05-12"),
      b("B", "2026-05-13"),
      b("C", "2026-05-14"),
    ];
    const r = unlockBadges(input({ history }));
    const streak = r.unlockedNow.find((u) => u.badge.key === "streak_3")!;
    expect(streak.notifyPayload).toBeNull();
  });

  it("isoMinusOneDay walks back across month boundary", () => {
    expect(__FOR_TEST__.isoMinusOneDay("2026-06-01")).toBe("2026-05-31");
    expect(__FOR_TEST__.isoMinusOneDay("2026-01-01")).toBe("2025-12-31");
  });

  it("streakDays returns 0 when isoDateLocal has no book", () => {
    const history = [b("A", "2026-05-13")];
    expect(__FOR_TEST__.streakDays(history, "2026-05-14")).toBe(0);
  });

  it("MILESTONE_TIERS contract is the canonical pinned list", () => {
    const counts = __FOR_TEST__.MILESTONE_TIERS.map((t) => t.count);
    expect(counts).toEqual([1, 5, 10, 25, 50, 100]);
  });

  it("kid headlines are positive across all categories", () => {
    const history = Array.from({ length: 10 }, (_, i) =>
      b(`Book ${i + 1}`, "2026-05-1" + (i % 10), { isChapterBook: i < 3 }),
    );
    const r = unlockBadges(input({ history }));
    for (const u of r.unlockedNow) {
      expect(u.kidHeadline).toBeTruthy();
      expect(u.kidHeadline.toLowerCase()).not.toMatch(
        /not enough|fail|behind|bad|punish/,
      );
    }
  });

  it("deterministic — same input ⇒ identical output", () => {
    const history = [b("A", "2026-05-13"), b("B", "2026-05-14")];
    const a = unlockBadges(input({ history }));
    const c = unlockBadges(input({ history }));
    expect(a).toEqual(c);
  });

  it("empty history ⇒ no unlocks, total=0, streak=0", () => {
    const r = unlockBadges(input({ history: [] }));
    expect(r.unlockedNow).toEqual([]);
    expect(r.totalBooksLifetime).toBe(0);
    expect(r.currentStreakDays).toBe(0);
  });

  it("series tier 5 fires only when 5 books in same series exist", () => {
    const history = Array.from({ length: 5 }, (_, i) =>
      b(`MTH ${i}`, "2026-05-1" + i, { seriesKey: "mth" }),
    );
    const r = unlockBadges(input({ history, latest: history[4] }));
    const keys = r.unlockedNow.map((u) => u.badge.key);
    expect(keys).toContain("series_mth_3");
    expect(keys).toContain("series_mth_5");
  });

  it("notifyPayload for milestone uses lifetime book# in content", () => {
    const history = Array.from({ length: 10 }, (_, i) => b(`B${i}`, "2026-05-1" + (i % 10)));
    const r = unlockBadges(input({ history, alreadyUnlockedBadgeKeys: ["first_book", "five_books"] }));
    const ten = r.unlockedNow.find((u) => u.badge.key === "ten_books")!;
    expect(ten.notifyPayload?.content).toContain("book #10");
  });
});
