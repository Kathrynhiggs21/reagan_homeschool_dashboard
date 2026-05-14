/**
 * Push 139 — Printed-book page reference contract.
 *
 * Pins:
 *   - Shelf is exactly the four canonical books, by slug
 *   - Tuck Everlasting / Michael's World use the verb "read"
 *   - Spectrum Sci 5 + 180 Days Lang 5 use "complete"
 *   - Single-page → "pg N", multi-page → "pg X–Y"
 *   - Unknown book / out-of-range / end<start / non-finite all rejected
 *     with distinct reasons
 *   - 180 Days helper picks day-page = school-day index, rejects
 *     non-day-paced books, rejects out-of-range school day
 */
import { describe, it, expect } from "vitest";
import {
  PRINTED_BOOK_SHELF,
  buildPrintedBookReference,
  lookupPrintedBook,
  pickDayPagedWorkbookReference,
} from "./_lib/printedBookReference";

describe("Push 139 — printed-book reference", () => {
  it("ships exactly the four canonical books", () => {
    const slugs = PRINTED_BOOK_SHELF.map((b) => b.slug).sort();
    expect(slugs).toEqual(
      ["180-days-language-5", "michaels-world", "spectrum-science-5", "tuck-everlasting"].sort(),
    );
  });

  it("Tuck Everlasting uses the verb 'read'", () => {
    const out = buildPrintedBookReference({
      slug: "tuck-everlasting",
      startPage: 14,
      endPage: 18,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.label).toBe("read pg 14–18 of Tuck Everlasting");
      expect(out.singlePage).toBe(false);
    }
  });

  it("single-page reads use 'pg N' format", () => {
    const out = buildPrintedBookReference({
      slug: "michaels-world",
      startPage: 7,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.label).toBe("read pg 7 of Michael's World");
      expect(out.singlePage).toBe(true);
    }
  });

  it("Spectrum Science uses 'complete' verb", () => {
    const out = buildPrintedBookReference({
      slug: "spectrum-science-5",
      startPage: 22,
      endPage: 23,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.label).toBe("complete pg 22–23 of Spectrum Science Grade 5");
    }
  });

  it("rejects unknown book slug", () => {
    const out = buildPrintedBookReference({
      // @ts-expect-error — intentional bad input
      slug: "harry-potter-1",
      startPage: 1,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejectReason).toBe("unknown-book");
  });

  it("rejects non-finite startPage", () => {
    const out = buildPrintedBookReference({
      slug: "tuck-everlasting",
      // @ts-expect-error — intentional bad input
      startPage: "five",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejectReason).toBe("non-finite-page");
  });

  it("rejects page out of book range", () => {
    const out = buildPrintedBookReference({
      slug: "tuck-everlasting",
      startPage: 200,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejectReason).toBe("page-out-of-range");
  });

  it("rejects endPage < startPage", () => {
    const out = buildPrintedBookReference({
      slug: "tuck-everlasting",
      startPage: 50,
      endPage: 30,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejectReason).toBe("end-before-start");
  });

  it("lookup returns the entry by slug", () => {
    const entry = lookupPrintedBook("180-days-language-5");
    expect(entry?.title).toBe("180 Days of Language for 5th Grade");
    expect(entry?.kind).toBe("day-paced-workbook");
    expect(entry?.totalPages).toBe(180);
    expect(entry?.verb).toBe("complete");
  });

  it("pickDayPagedWorkbookReference: day 1 → pg 1", () => {
    const out = pickDayPagedWorkbookReference({
      slug: "180-days-language-5",
      schoolDayIndex: 1,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.label).toBe("complete pg 1 of 180 Days of Language for 5th Grade");
      expect(out.singlePage).toBe(true);
    }
  });

  it("pickDayPagedWorkbookReference rejects when slug is not a day-paced workbook", () => {
    const out = pickDayPagedWorkbookReference({
      slug: "tuck-everlasting",
      schoolDayIndex: 1,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejectReason).toBe("unknown-book");
  });

  it("pickDayPagedWorkbookReference rejects when schoolDayIndex > 180", () => {
    const out = pickDayPagedWorkbookReference({
      slug: "180-days-language-5",
      schoolDayIndex: 181,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejectReason).toBe("page-out-of-range");
  });

  it("pickDayPagedWorkbookReference rejects non-positive school day", () => {
    const out = pickDayPagedWorkbookReference({
      slug: "180-days-language-5",
      schoolDayIndex: 0,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejectReason).toBe("non-finite-page");
  });
});
