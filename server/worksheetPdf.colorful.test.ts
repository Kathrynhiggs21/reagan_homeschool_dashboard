/**
 * 2026-06-17 — Coverage for the colorful worksheet PDF renderer.
 *
 * Verifies:
 *  - a valid, non-empty PDF buffer is produced;
 *  - the page-per-assignment rule holds: N sections => at least N pages
 *    (each section after the first opens a fresh page), plus the answer key
 *    lands on its own additional page.
 */
import { describe, it, expect } from "vitest";
import { renderWorksheetPdfBuffer } from "./_lib/worksheetPdf";
import type { WorksheetContent } from "@shared/worksheetTypes";

function countPdfPages(buf: Buffer): number {
  // pdfkit writes one "/Type /Page" object per page (not "/Pages").
  const text = buf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

const THREE_SECTIONS: WorksheetContent = {
  title: "Summer Math Adventure",
  intro: "Today we practice place value, addition, and a short story problem.",
  subjectSlug: "math",
  sections: [
    {
      heading: "Place Value",
      instructions: "Write the value of the underlined digit.",
      items: [
        { id: "q1", kind: "short", prompt: "The 4 in 3,452 means ____.", answer: "400" },
        { id: "q2", kind: "mc", prompt: "Which is greatest?", choices: ["1,209", "1,290", "1,029"], answer: "1,290" },
      ],
    },
    {
      heading: "Addition",
      instructions: "Solve each problem.",
      items: [
        { id: "q3", kind: "short", prompt: "245 + 178 = ____", answer: "423" },
        { id: "q4", kind: "long", prompt: "Explain how you regrouped.", lines: 2 },
      ],
    },
    {
      heading: "Story Problem",
      items: [
        { id: "p1", kind: "passage", prompt: "Mia has 12 stickers and gives away 5." },
        { id: "q5", kind: "short", prompt: "How many are left?", answer: "7" },
      ],
    },
  ],
};

describe("colorful worksheet PDF renderer", () => {
  it("produces a valid, non-empty PDF buffer", async () => {
    const buf = await renderWorksheetPdfBuffer(THREE_SECTIONS, { dateLabel: "2026-06-17", withAnswerKey: false });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(800);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("starts each section on its own page (page-per-assignment)", async () => {
    // 3 sections, no answer key => at least 3 pages.
    const noKey = await renderWorksheetPdfBuffer(THREE_SECTIONS, { withAnswerKey: false });
    expect(countPdfPages(noKey)).toBeGreaterThanOrEqual(3);
  });

  it("puts the answer key on its own additional page", async () => {
    const withKey = await renderWorksheetPdfBuffer(THREE_SECTIONS, { withAnswerKey: true });
    const noKey = await renderWorksheetPdfBuffer(THREE_SECTIONS, { withAnswerKey: false });
    expect(countPdfPages(withKey)).toBeGreaterThan(countPdfPages(noKey));
  });

  it("handles a single-section worksheet without throwing", async () => {
    const one: WorksheetContent = {
      title: "Quick Practice",
      sections: [{ heading: "Warm Up", items: [{ id: "a", kind: "short", prompt: "2 + 2 = ?", answer: "4" }] }],
    };
    const buf = await renderWorksheetPdfBuffer(one, { withAnswerKey: true });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(countPdfPages(buf)).toBeGreaterThanOrEqual(2); // content page + answer key page
  });
});
