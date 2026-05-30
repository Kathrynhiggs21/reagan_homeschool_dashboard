import { describe, it, expect } from "vitest";
import {
  findBestPrintableForBlock,
  findAllPrintablesForBlock,
} from "@/lib/matchPrintable";
import type { TodayPrintableItem } from "@/components/TodaySchoolWork";

/**
 * 2026-05-30 — bug fix: tapping an assignment block on the homepage agenda
 * was opening the first subject-matching printable for the day instead of
 * the worksheet pinned to that specific block. These tests lock the new
 * priority order:
 *   1. The row pinned to the tapped block (block_id match) — wins
 *      regardless of subject, status, or score.
 *   2. The subject-slug ranker — same behaviour as before.
 *   3. Empty / curated fallback — caller's responsibility.
 */
function row(id: number, partial: Partial<TodayPrintableItem>): TodayPrintableItem {
  return {
    id,
    title: `row-${id}`,
    source: "test",
    status: "pending",
    ...partial,
  } as TodayPrintableItem;
}

describe("findBestPrintableForBlock — block-pinned wins over subject", () => {
  it("returns the block-pinned row even when a higher-scored subject row exists", () => {
    const items: TodayPrintableItem[] = [
      // generic Math worksheet, not pinned to any block
      row(1, { title: "Generic fractions", subjectSlug: "math", bucket: "have_to_do" }),
      // pinned to block 42, but tagged as "ela" (subject mismatch on purpose)
      row(2, { title: "Block 42 specific", subjectSlug: "ela", blockId: "42" }),
    ];
    const got = findBestPrintableForBlock(items, { id: 42, subjectSlug: "math", title: "Math block" });
    expect(got?.id).toBe(2);
  });

  it("falls back to subject ranking when no row is pinned to this block", () => {
    const items: TodayPrintableItem[] = [
      row(1, { title: "Other block's worksheet", subjectSlug: "math", blockId: "99" }),
      row(2, { title: "Generic math", subjectSlug: "math", bucket: "have_to_do" }),
    ];
    const got = findBestPrintableForBlock(items, { id: 42, subjectSlug: "math", title: "Math block" });
    // Block 42 has no pinned row, so the subject ranker picks the generic one.
    expect(got?.id).toBe(2);
  });

  it("prefers a non-done pinned row over a done pinned row", () => {
    const items: TodayPrintableItem[] = [
      row(1, { title: "Old try", blockId: "42", status: "done", subjectSlug: "math" }),
      row(2, { title: "Live try", blockId: "42", status: "pending", subjectSlug: "math" }),
    ];
    const got = findBestPrintableForBlock(items, { id: 42, subjectSlug: "math", title: "Math block" });
    expect(got?.id).toBe(2);
  });

  it("coerces blockId types — number block.id matches string item.blockId", () => {
    const items: TodayPrintableItem[] = [
      row(1, { title: "Pinned to 42", blockId: "42", subjectSlug: "math" }),
    ];
    const got = findBestPrintableForBlock(items, { id: 42, subjectSlug: "math", title: "Math block" });
    expect(got?.id).toBe(1);
  });

  it("returns null on an empty list", () => {
    expect(findBestPrintableForBlock([], { id: 1, subjectSlug: "math" })).toBeNull();
  });
});

describe("findAllPrintablesForBlock — pinned thumbnails first", () => {
  it("puts pinned rows ahead of subject matches in the returned strip", () => {
    const items: TodayPrintableItem[] = [
      row(1, { title: "Generic A", subjectSlug: "math", bucket: "have_to_do" }),
      row(2, { title: "Generic B", subjectSlug: "math", bucket: "optional" }),
      row(3, { title: "Pinned to 42", blockId: "42", subjectSlug: "ela" }),
    ];
    const got = findAllPrintablesForBlock(items, { id: 42, subjectSlug: "math", title: "Math block" }, 3);
    expect(got.map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it("respects the limit when there are more pinned rows than the limit allows", () => {
    const items: TodayPrintableItem[] = [
      row(1, { title: "Pinned A", blockId: "42" }),
      row(2, { title: "Pinned B", blockId: "42" }),
      row(3, { title: "Pinned C", blockId: "42" }),
      row(4, { title: "Pinned D", blockId: "42" }),
      row(99, { title: "Subject only", subjectSlug: "math", bucket: "have_to_do" }),
    ];
    const got = findAllPrintablesForBlock(items, { id: 42, subjectSlug: "math", title: "Math" }, 3);
    expect(got).toHaveLength(3);
    // All three should be pinned rows; the subject-only one must not steal a slot.
    for (const r of got) expect(r.blockId).toBe("42");
  });

  it("returns subject matches when nothing is pinned", () => {
    const items: TodayPrintableItem[] = [
      row(1, { title: "Generic math A", subjectSlug: "math", bucket: "have_to_do" }),
      row(2, { title: "Generic math B", subjectSlug: "math", bucket: "optional" }),
    ];
    const got = findAllPrintablesForBlock(items, { id: 42, subjectSlug: "math", title: "Math" }, 3);
    expect(got.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  it("does not duplicate a row that is both pinned and subject-matched", () => {
    const items: TodayPrintableItem[] = [
      row(1, { title: "Pinned + math", blockId: "42", subjectSlug: "math", bucket: "have_to_do" }),
    ];
    const got = findAllPrintablesForBlock(items, { id: 42, subjectSlug: "math", title: "Math" }, 3);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe(1);
  });
});
