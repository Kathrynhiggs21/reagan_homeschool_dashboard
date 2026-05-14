import { describe, expect, it } from "vitest";
import {
  applyBookReadingSession,
  rollupShelfProgress,
} from "./_lib/bookReadingProgress";

describe("Push 140 — book-reading progress tracker", () => {
  it("rejects unknown books", () => {
    const r = applyBookReadingSession({
      session: { slug: "the-hobbit", startPage: 1, endPage: 5 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("unknown-book");
  });

  it("rejects missing page data on literature", () => {
    const r = applyBookReadingSession({
      session: { slug: "tuck-everlasting" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("missing-page-data");
  });

  it("rejects pages outside the book", () => {
    const r = applyBookReadingSession({
      session: { slug: "tuck-everlasting", startPage: 1, endPage: 999 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("page-out-of-range");
  });

  it("rejects endPage < startPage", () => {
    const r = applyBookReadingSession({
      session: { slug: "michaels-world", startPage: 30, endPage: 20 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("invalid-page-range");
  });

  it("advances Tuck Everlasting from page 0 to 25", () => {
    const r = applyBookReadingSession({
      priorHighestPage: 0,
      session: { slug: "tuck-everlasting", startPage: 1, endPage: 25 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newHighestPage).toBe(25);
      expect(r.totalPages).toBe(140);
      expect(r.pagesReadThisSession).toBe(25);
      expect(r.pagesRemaining).toBe(115);
      expect(r.completionPercent).toBe(18);
      expect(r.advanced).toBe(true);
      expect(r.isComplete).toBe(false);
    }
  });

  it("does not regress when re-reading earlier pages", () => {
    const r = applyBookReadingSession({
      priorHighestPage: 80,
      session: { slug: "tuck-everlasting", startPage: 10, endPage: 20 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newHighestPage).toBe(80);
      expect(r.advanced).toBe(false);
    }
  });

  it("marks Spectrum Sci 5 complete when reaching final page", () => {
    const r = applyBookReadingSession({
      priorHighestPage: 149,
      session: { slug: "spectrum-science-5", startPage: 150, endPage: 150 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.isComplete).toBe(true);
      expect(r.completionPercent).toBe(100);
      expect(r.pagesRemaining).toBe(0);
    }
  });

  it("rejects no-progress-recorded after book is fully complete", () => {
    const r = applyBookReadingSession({
      priorHighestPage: 150,
      session: { slug: "spectrum-science-5", startPage: 50, endPage: 60 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("no-progress-recorded");
  });

  it("resolves day-paced workbook by dayNumber → page", () => {
    const r = applyBookReadingSession({
      priorHighestPage: 0,
      session: { slug: "180-days-language-5", dayNumber: 1 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.resolvedRange).toEqual({ startPage: 1, endPage: 1 });
      expect(r.newHighestPage).toBe(1);
      expect(r.totalPages).toBe(180);
    }
  });

  it("rejects invalid dayNumber on day-paced workbook", () => {
    const r = applyBookReadingSession({
      session: { slug: "180-days-language-5", dayNumber: 0 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejectReason).toBe("invalid-day-number");
    const r2 = applyBookReadingSession({
      session: { slug: "180-days-language-5", dayNumber: 181 },
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.rejectReason).toBe("invalid-day-number");
  });

  it("clamps negative or non-finite priorHighestPage to 0", () => {
    const r = applyBookReadingSession({
      priorHighestPage: -50,
      session: { slug: "michaels-world", startPage: 1, endPage: 12 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.newHighestPage).toBe(12);
    const r2 = applyBookReadingSession({
      priorHighestPage: Number.NaN,
      session: { slug: "michaels-world", startPage: 1, endPage: 12 },
    });
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.advanced).toBe(true);
  });

  it("rolls up shelf across mixed valid + invalid sessions", () => {
    const out = rollupShelfProgress(
      { "tuck-everlasting": 10 },
      [
        { slug: "tuck-everlasting", startPage: 11, endPage: 30 },
        { slug: "spectrum-science-5", startPage: 1, endPage: 50 },
        { slug: "180-days-language-5", dayNumber: 5 },
        { slug: "fake-book", startPage: 1, endPage: 1 } as any,
        null as any,
      ],
    );
    const tuck = out.find((b) => b.slug === "tuck-everlasting")!;
    const spec = out.find((b) => b.slug === "spectrum-science-5")!;
    const days = out.find((b) => b.slug === "180-days-language-5")!;
    const mw = out.find((b) => b.slug === "michaels-world")!;
    expect(tuck.newHighestPage).toBe(30);
    expect(spec.newHighestPage).toBe(50);
    expect(days.newHighestPage).toBe(5);
    expect(mw.newHighestPage).toBe(0);
    expect(out).toHaveLength(4);
  });

  it("rounds completion percent and never exceeds 100", () => {
    const r = applyBookReadingSession({
      priorHighestPage: 0,
      session: { slug: "tuck-everlasting", startPage: 1, endPage: 140 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.completionPercent).toBe(100);
      expect(r.completionRatio).toBe(1);
      expect(r.isComplete).toBe(true);
    }
  });
});
