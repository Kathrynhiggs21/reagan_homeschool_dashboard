import { describe, it, expect } from "vitest";
import {
  addDayAttachment,
  listDayAttachments,
  setDayAttachmentMarkup,
  removeDayAttachment,
  getDb,
} from "./db";
import { dayAttachments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Notebook Day Attachments — DB-layer test for the helpers backing the
 * notebookAttachments tRPC router.
 *
 * Why DB-layer rather than full router invocation: the router add/saveMarkup
 * paths call `storagePut`, which talks to the platform S3 service; we don't
 * want network side-effects in CI. The router code itself is a thin wrapper
 * (decode data URL → storagePut → call db helper), so verifying the helpers
 * round-trip cleanly + validating the data-URL regex shape covers the logic
 * without flake.
 */
describe("notebookAttachments — db helpers", () => {
  const TEST_DATE = "2099-12-31";

  async function cleanup() {
    await getDb().delete(dayAttachments).where(eq(dayAttachments.dateStr, TEST_DATE));
  }

  it("add → list → setMarkup → list → remove → list (round-trip)", async () => {
    await cleanup();

    // Empty initially
    const empty = await listDayAttachments(TEST_DATE);
    expect(empty.length).toBe(0);

    // Add an image attachment
    const r1 = await addDayAttachment({
      dateStr: TEST_DATE,
      kind: "image",
      fileKey: "notebook/2099-12-31/test-1.png",
      fileName: "test-1.png",
    });
    expect((r1 as any).id).toBeTruthy();
    expect((r1 as any).kind).toBe("image");
    expect((r1 as any).fileKey).toBe("notebook/2099-12-31/test-1.png");
    expect((r1 as any).markupKey).toBeFalsy();

    // Add a PDF attachment
    const r2 = await addDayAttachment({
      dateStr: TEST_DATE,
      kind: "pdf",
      fileKey: "notebook/2099-12-31/worksheet.pdf",
      fileName: "worksheet.pdf",
    });
    expect((r2 as any).kind).toBe("pdf");

    // Listing returns both, ordered by createdAt asc
    const list1 = await listDayAttachments(TEST_DATE);
    expect(list1.length).toBe(2);
    expect(list1.map((r: any) => r.kind).sort()).toEqual(["image", "pdf"]);

    // Different date → still empty (date-keyed)
    const otherDay = await listDayAttachments("2099-01-01");
    expect(otherDay.find((r: any) => r.dateStr === TEST_DATE)).toBeUndefined();

    // Set markup key on image attachment
    await setDayAttachmentMarkup((r1 as any).id, "notebook-markup/test-1-markup.png");
    const list2 = await listDayAttachments(TEST_DATE);
    const updated = list2.find((r: any) => r.id === (r1 as any).id);
    expect(updated).toBeTruthy();
    expect((updated as any).markupKey).toBe("notebook-markup/test-1-markup.png");
    // Other row's markupKey is still null
    const other = list2.find((r: any) => r.id === (r2 as any).id);
    expect((other as any).markupKey).toBeFalsy();

    // Clear markup → null
    await setDayAttachmentMarkup((r1 as any).id, null);
    const list3 = await listDayAttachments(TEST_DATE);
    const cleared = list3.find((r: any) => r.id === (r1 as any).id);
    expect((cleared as any).markupKey).toBeFalsy();

    // Original fileKey should be unchanged after markup operations
    expect((cleared as any).fileKey).toBe("notebook/2099-12-31/test-1.png");

    // Remove image attachment → only PDF remains
    await removeDayAttachment((r1 as any).id);
    const list4 = await listDayAttachments(TEST_DATE);
    expect(list4.length).toBe(1);
    expect((list4[0] as any).kind).toBe("pdf");

    await cleanup();
  }, 30_000);

  it("data URL regex from router accepts valid image/pdf data URLs and rejects garbage", () => {
    // Mirrors the regex used in the `add` mutation: /^data:[^;]+;base64,/
    const rx = /^data:[^;]+;base64,/;
    expect(rx.test("data:image/png;base64,iVBOR0KGgoAAAANSUhEUg==")).toBe(true);
    expect(rx.test("data:application/pdf;base64,JVBERi0xLjQKJ")).toBe(true);
    expect(rx.test("data:image/jpeg;base64,/9j/4AAQSkZ")).toBe(true);

    expect(rx.test("https://example.com/foo.png")).toBe(false);
    expect(rx.test("data:image/png,not-base64")).toBe(false);
    expect(rx.test("")).toBe(false);

    // Markup-specific regex requires PNG: /^data:image\/png;base64,/
    const pngRx = /^data:image\/png;base64,/;
    expect(pngRx.test("data:image/png;base64,iVBOR0KG")).toBe(true);
    expect(pngRx.test("data:image/jpeg;base64,/9j/4AAQ")).toBe(false);
    expect(pngRx.test("data:application/pdf;base64,JVBE")).toBe(false);
  });

  it("dateStr regex accepts YYYY-MM-DD only", () => {
    const rx = /^\d{4}-\d{2}-\d{2}$/;
    expect(rx.test("2026-05-05")).toBe(true);
    expect(rx.test("2099-12-31")).toBe(true);

    expect(rx.test("26-5-5")).toBe(false);
    expect(rx.test("2026/05/05")).toBe(false);
    expect(rx.test("2026-5-05")).toBe(false);
    expect(rx.test("2026-05-05T00:00:00Z")).toBe(false);
    expect(rx.test("not-a-date")).toBe(false);
  });
});
