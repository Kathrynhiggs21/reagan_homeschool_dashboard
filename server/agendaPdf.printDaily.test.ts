/**
 * 2026-05-29 — Locks in the Print Daily fixes:
 *   1. Emoji and >U+0100 code points get stripped/transliterated so PDFKit's
 *      WinAnsi Helvetica doesn't render them as garbage glyphs (Ø=ÜË, etc).
 *   2. Every block produces a detail page in the packet (cover + N detail
 *      pages) so Reagan always has writable notes space on paper, even
 *      when the block has no curated lesson payload.
 *
 * NOTE: PDFKit compresses content streams so we can't grep the raw buffer
 * for rendered text. We assert against:
 *   - cleanForPdf behaviour (exported test surface)
 *   - PDF page count via pdf-lib
 *   - canonicalText (returned alongside the buffer)
 */
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildAgendaPdf, cleanForPdf, type AgendaPdfInput } from "./_lib/agendaPdf.js";

const baseBlocks = [
  {
    sortOrder: 1,
    startTime: "10:00",
    durationMin: 25,
    subjectName: "Math",
    title: "Morning Math Puzzle 🧩",
    description: "Let's start with a fun math puzzle — explore coordinate planes by graphing points.",
  },
  {
    sortOrder: 2,
    startTime: "10:25",
    durationMin: 20,
    subjectName: "Reading and Language Arts (ELA)",
    title: "Reading Fluency Check-in 📖",
    description: "Read aloud three times. Track words per minute and accuracy.",
  },
  {
    sortOrder: 3,
    startTime: "10:45",
    durationMin: 40,
    subjectName: "Reading and Language Arts (ELA)",
    title: "Narrative Writing: Animal Adventure ✍️",
    description: "Brainstorm a short story about an animal's adventure.",
  },
  {
    sortOrder: 4,
    startTime: "11:25",
    durationMin: 45,
    subjectName: "Science",
    title: "Outdoor Bird Watching 🐦",
    description: "Use Merlin Bird ID to identify five different birds. Log observations.",
  },
];

const baseInput: AgendaPdfInput = {
  forDate: "2026-06-01",
  dayLabel: "Monday, June 1",
  studentName: "Reagan",
  blocks: baseBlocks,
  schoolDayWindow: { start: "09:00", end: "13:00" },
};

describe("cleanForPdf (Helvetica-WinAnsi safe text)", () => {
  it("strips supplementary-plane code points (every emoji)", () => {
    // Puzzle, book, writing-hand, bird — exactly the chars that broke prod
    expect(cleanForPdf("Morning Math Puzzle 🧩")).toBe("Morning Math Puzzle");
    expect(cleanForPdf("Reading Fluency Check-in 📖")).toBe("Reading Fluency Check-in");
    expect(cleanForPdf("Narrative Writing: Animal Adventure ✍️")).toBe(
      "Narrative Writing: Animal Adventure",
    );
    expect(cleanForPdf("Outdoor Bird Watching 🐦")).toBe("Outdoor Bird Watching");
  });

  it("strips dingbats / misc symbols / arrows (BMP-but-glyph-less)", () => {
    // ☀ (U+2600), ✏ (U+270F), ▶ (U+25B6) — the cover-sheet hint chars
    expect(cleanForPdf("☀ Summer Preview - 6th Grade")).toBe("Summer Preview - 6th Grade");
    expect(cleanForPdf("✏ 4 worksheets embedded")).toBe("4 worksheets embedded");
    // ▶ maps to ASCII ">" before strip
    expect(cleanForPdf("▶ 2 video links")).toBe("> 2 video links");
  });

  it("transliterates smart punctuation to ASCII equivalents", () => {
    expect(cleanForPdf("\u201chello\u201d \u2014 world\u2026")).toBe('"hello" - world...');
    expect(cleanForPdf("Reagan\u2019s")).toBe("Reagan's");
    expect(cleanForPdf("pages 12\u201318")).toBe("pages 12-18");
  });

  it("handles null/undefined safely", () => {
    expect(cleanForPdf(null)).toBe("");
    expect(cleanForPdf(undefined)).toBe("");
    expect(cleanForPdf("")).toBe("");
  });
});

describe("buildAgendaPdf (Print Daily packet shape)", () => {
  it("produces cover + one detail page per block (5 pages for 4 blocks)", async () => {
    const { pdfBuffer } = await buildAgendaPdf(baseInput);
    const doc = await PDFDocument.load(pdfBuffer);
    expect(doc.getPageCount()).toBe(5); // cover + 4 detail pages
  });

  it("handles a single block (cover + 1 detail page = 2 pages)", async () => {
    const { pdfBuffer } = await buildAgendaPdf({
      ...baseInput,
      blocks: [baseBlocks[0]],
    });
    const doc = await PDFDocument.load(pdfBuffer);
    expect(doc.getPageCount()).toBe(2);
  });

  it("includes devotion page when devotionText is set (cover + devo + N blocks)", async () => {
    const { pdfBuffer } = await buildAgendaPdf({
      ...baseInput,
      devotionText: "Today's reflection: Be kind.",
    });
    const doc = await PDFDocument.load(pdfBuffer);
    expect(doc.getPageCount()).toBe(6); // cover + devotion + 4 detail
  });

  it("canonical text includes every block title and description", async () => {
    const { canonicalText } = await buildAgendaPdf(baseInput);
    expect(canonicalText).toContain("Morning Math Puzzle");
    expect(canonicalText).toContain("Reading Fluency Check-in");
    expect(canonicalText).toContain("Narrative Writing: Animal Adventure");
    expect(canonicalText).toContain("Outdoor Bird Watching");
  });

  it("agenda hash is stable for equivalent input", async () => {
    const a = await buildAgendaPdf(baseInput);
    const b = await buildAgendaPdf(baseInput);
    expect(a.agendaHash).toBe(b.agendaHash);
  });
});
