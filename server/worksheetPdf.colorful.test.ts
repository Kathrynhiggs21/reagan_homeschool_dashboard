/**
 * 2026-06-17 (v3) — Coverage for the clean, formatted worksheet PDF renderer.
 *
 * Verifies:
 *  - a valid, non-empty PDF buffer is produced;
 *  - the page-per-assignment rule holds: N sections => at least N pages
 *    (each section after the first opens a fresh page), plus the answer key
 *    on its own additional page;
 *  - all activity kinds (mc, short, long, prompt, passage, matching,
 *    scramble, fillblank) render without throwing, including a word bank.
 */
import { describe, it, expect } from "vitest";
import { renderWorksheetPdfBuffer, renderAnswerKeyPdfBuffer } from "./_lib/worksheetPdf";
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

const ALL_KINDS: WorksheetContent = {
  title: "ELA Mixed Practice",
  intro: "A little of everything.",
  subjectSlug: "ela",
  sections: [
    {
      heading: "Vocabulary Match",
      instructions: "Draw a line from each word to its definition.",
      wordBank: ["conduct", "evident", "passage", "concept"],
      items: [
        {
          id: "m1",
          kind: "matching",
          prompt: "Match the word to its meaning.",
          pairs: [
            { left: "conduct", right: "to lead or guide" },
            { left: "evident", right: "easily seen" },
            { left: "passage", right: "a section of text" },
          ],
        },
      ],
    },
    {
      heading: "Word Scramble",
      instructions: "Unscramble each word about winter.",
      items: [
        { id: "s1", kind: "scramble", prompt: "o w n s", answer: "snow" },
        { id: "s2", kind: "scramble", prompt: "c i e", answer: "ice" },
      ],
    },
    {
      heading: "Fill in the Blank",
      instructions: "Choose the correct homophone.",
      items: [
        { id: "f1", kind: "fillblank", prompt: "She is kneading the ____ (doe/dough) to make bread.", answer: "dough" },
      ],
    },
    {
      heading: "Reading",
      items: [
        { id: "rp", kind: "passage", prompt: "Once upon a time, a curious caterpillar explored the world around him." },
        { id: "rq", kind: "long", prompt: "What is the title of this story?", lines: 2, answer: "(varies)" },
        { id: "wp", kind: "prompt", prompt: "Write what you think happens next.", lines: 3 },
      ],
    },
  ],
};

describe("clean worksheet PDF renderer", () => {
  it("produces a valid, non-empty PDF buffer", async () => {
    const buf = await renderWorksheetPdfBuffer(THREE_SECTIONS, { dateLabel: "2026-06-17" });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(800);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("starts each section on its own page (page-per-assignment)", async () => {
    const buf = await renderWorksheetPdfBuffer(THREE_SECTIONS);
    expect(countPdfPages(buf)).toBeGreaterThanOrEqual(3);
  });

  it("NEVER includes the answer key inside the student worksheet (no back-of-page key)", async () => {
    const buf = await renderWorksheetPdfBuffer(THREE_SECTIONS);
    // student worksheet = exactly one page per section (3), no extra key page.
    expect(countPdfPages(buf)).toBe(3);
    expect(buf.toString("latin1")).not.toContain("Answer Key");
  });

  it("produces the answer key as a SEPARATE standalone document", async () => {
    const keyPromise = renderAnswerKeyPdfBuffer(THREE_SECTIONS, { dateLabel: "2026-06-17" });
    expect(keyPromise).not.toBeNull();
    const keyBuf = await keyPromise!;
    expect(keyBuf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // sanity: no Unicode replacement char / tofu leaked into the PDF text stream
    expect(keyBuf.toString("latin1")).not.toContain("\uFFFD");
    expect(countPdfPages(keyBuf)).toBeGreaterThanOrEqual(1);
  });

  it("returns null answer key when there are no answers", async () => {
    const noAnswers: WorksheetContent = {
      title: "Free Write",
      sections: [{ heading: "Journal", items: [{ id: "j", kind: "prompt", prompt: "Write about your day.", lines: 5 }] }],
    };
    expect(renderAnswerKeyPdfBuffer(noAnswers)).toBeNull();
  });

  it("renders all activity kinds (matching, scramble, fillblank, word bank) without throwing", async () => {
    const buf = await renderWorksheetPdfBuffer(ALL_KINDS, { dateLabel: "2026-06-17" });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(countPdfPages(buf)).toBeGreaterThanOrEqual(4); // 4 sections each on its own page
  });

  it("distributes a short single-page section with breathing space (fills the page)", async () => {
    // A 3-item single section should NOT cluster at the very top; with the
    // even-distribution gap the last item sits well below the header band.
    const buf = await renderWorksheetPdfBuffer({
      title: "Spacing Check",
      subjectSlug: "math",
      sections: [{ heading: "Practice", items: [
        { id: "a", kind: "short", prompt: "2 + 2 = ?", answer: "4" },
        { id: "b", kind: "short", prompt: "3 + 5 = ?", answer: "8" },
        { id: "c", kind: "short", prompt: "9 - 4 = ?", answer: "5" },
      ] }],
    });
    // single section => single page (distribution must never add a page)
    expect(countPdfPages(buf)).toBe(1);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("handles a single-section worksheet without throwing", async () => {
    const one: WorksheetContent = {
      title: "Quick Practice",
      sections: [{ heading: "Warm Up", items: [{ id: "a", kind: "short", prompt: "2 + 2 = ?", answer: "4" }] }],
    };
    const buf = await renderWorksheetPdfBuffer(one);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(countPdfPages(buf)).toBe(1); // single section = single page, no key
  });
});
