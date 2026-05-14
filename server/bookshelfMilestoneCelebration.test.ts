import { describe, it, expect } from "vitest";
import { computeBookshelfMilestone } from "./_lib/bookshelfMilestoneCelebration";

const today = "2026-05-15";

describe("Push 179 — Bookshelf milestone celebration", () => {
  it("returns no celebration when nothing changed", () => {
    const r = computeBookshelfMilestone({
      todayISO: today,
      todaySnapshot: [
        { bookId: "tuck", title: "Tuck Everlasting", chaptersRead: 5, totalChapters: 25 },
      ],
      yesterdaySnapshot: [
        { bookId: "tuck", title: "Tuck Everlasting", chaptersRead: 5, totalChapters: 25 },
      ],
    });
    expect(r.notice).toBe(false);
    expect(r.trigger).toBe("none");
    expect(r.kidLine).toBe("");
  });

  it("celebrates finishing a book", () => {
    const r = computeBookshelfMilestone({
      todayISO: today,
      todaySnapshot: [
        { bookId: "tuck", title: "Tuck Everlasting", chaptersRead: 25, totalChapters: 25 },
      ],
      yesterdaySnapshot: [
        { bookId: "tuck", title: "Tuck Everlasting", chaptersRead: 24, totalChapters: 25 },
      ],
    });
    expect(r.notice).toBe(true);
    expect(r.trigger).toBe("finished_book");
    expect(r.kidLine).toMatch(/Tuck Everlasting/);
    expect(r.adultLogEntry).toMatch(/finished Tuck Everlasting/);
    expect(r.celebrationId).toMatch(/^finished:tuck:/);
  });

  it("celebrates the highest quarter when multiple cross", () => {
    const r = computeBookshelfMilestone({
      todayISO: today,
      todaySnapshot: [
        { bookId: "tuck", title: "Tuck Everlasting", chaptersRead: 7, totalChapters: 25 }, // 28%
        { bookId: "michael", title: "Michael's World", chaptersRead: 8, totalChapters: 10 }, // 80%
      ],
      yesterdaySnapshot: [
        { bookId: "tuck", title: "Tuck Everlasting", chaptersRead: 6, totalChapters: 25 }, // 24%
        { bookId: "michael", title: "Michael's World", chaptersRead: 7, totalChapters: 10 }, // 70%
      ],
    });
    expect(r.notice).toBe(true);
    expect(r.trigger).toBe("quarter_crossed");
    expect(r.kidLine).toMatch(/75%/);
    expect(r.kidLine).toMatch(/Michael's World/);
  });

  it("celebrates 3+ chapters today across the shelf", () => {
    const r = computeBookshelfMilestone({
      todayISO: today,
      todaySnapshot: [
        { bookId: "tuck", title: "Tuck Everlasting", chaptersRead: 7, totalChapters: 25 },
        { bookId: "michael", title: "Michael's World", chaptersRead: 5, totalChapters: 10 },
      ],
      yesterdaySnapshot: [
        { bookId: "tuck", title: "Tuck Everlasting", chaptersRead: 5, totalChapters: 25 },
        { bookId: "michael", title: "Michael's World", chaptersRead: 4, totalChapters: 10 },
      ],
    });
    expect(r.notice).toBe(true);
    expect(r.trigger).toBe("three_today");
    expect(r.kidLine).toMatch(/3 chapters today/);
  });

  it("celebrates picking a book back up after a 7+ day gap", () => {
    const r = computeBookshelfMilestone({
      todayISO: today,
      todaySnapshot: [
        {
          bookId: "tuck",
          title: "Tuck Everlasting",
          chaptersRead: 6,
          totalChapters: 25,
          lastReadISO: today,
        },
      ],
      yesterdaySnapshot: [
        {
          bookId: "tuck",
          title: "Tuck Everlasting",
          chaptersRead: 5,
          totalChapters: 25,
          lastReadISO: "2026-05-01",
        },
      ],
    });
    expect(r.notice).toBe(true);
    expect(r.trigger).toBe("returned_after_gap");
    expect(r.kidLine).toMatch(/Welcome back/);
  });

  it("never uses comparison or grade language", () => {
    const banned = /\b(grade|graded|points?|score|ahead|behind|than other kids|good job|great job)\b/i;
    const r = computeBookshelfMilestone({
      todayISO: today,
      todaySnapshot: [
        { bookId: "tuck", title: "Tuck", chaptersRead: 25, totalChapters: 25 },
      ],
      yesterdaySnapshot: [
        { bookId: "tuck", title: "Tuck", chaptersRead: 24, totalChapters: 25 },
      ],
    });
    expect(r.kidLine).not.toMatch(banned);
    expect(r.adultLogEntry).not.toMatch(banned);
  });

  it("is deterministic via celebrationId", () => {
    const inp = {
      todayISO: today,
      todaySnapshot: [
        { bookId: "tuck", title: "Tuck", chaptersRead: 25, totalChapters: 25 },
      ],
      yesterdaySnapshot: [
        { bookId: "tuck", title: "Tuck", chaptersRead: 24, totalChapters: 25 },
      ],
    };
    const a = computeBookshelfMilestone(inp);
    const b = computeBookshelfMilestone(inp);
    expect(a.celebrationId).toBe(b.celebrationId);
  });

  it("rejects malformed todayISO", () => {
    expect(() =>
      computeBookshelfMilestone({
        todayISO: "May 15",
        todaySnapshot: [],
      }),
    ).toThrow();
  });

  it("returns no celebration on empty snapshot", () => {
    const r = computeBookshelfMilestone({
      todayISO: today,
      todaySnapshot: [],
    });
    expect(r.notice).toBe(false);
    expect(r.trigger).toBe("none");
  });

  it("emits at most ONE celebration when multiple triggers could fire", () => {
    // Finished AND >= 3 chapters today AND quarter — finished wins.
    const r = computeBookshelfMilestone({
      todayISO: today,
      todaySnapshot: [
        { bookId: "a", title: "A", chaptersRead: 10, totalChapters: 10 },
        { bookId: "b", title: "B", chaptersRead: 5, totalChapters: 10 },
      ],
      yesterdaySnapshot: [
        { bookId: "a", title: "A", chaptersRead: 7, totalChapters: 10 },
        { bookId: "b", title: "B", chaptersRead: 4, totalChapters: 10 },
      ],
    });
    expect(r.trigger).toBe("finished_book");
  });
});
