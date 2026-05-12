import { describe, it, expect } from "vitest";
import { buildAgendaPdf, type AgendaPdfInput } from "./_lib/agendaPdf";

/**
 * Proves that the nightly agenda packet PDF actually contains worksheet
 * questions AND the adult answer key for blocks whose lesson payload includes
 * them. This is the structural guarantee that "everything Mom (or a sub
 * tutor) needs is in the print-out" — no need to log into the dashboard,
 * no need to hunt for a separate answer-key file.
 *
 * Strategy: build the PDF, parse it with pdfjs-dist (already a project
 * dependency), concatenate all visible text across all pages, then assert
 * the worksheet questions + answer-key string appear.
 *
 * Note: this is a content-presence test, not a layout test.
 */

const PAYLOAD: AgendaPdfInput = {
  forDate: "2026-05-13",
  dayLabel: "Tuesday, May 13",
  studentName: "Reagan",
  tutorName: "Marcy",
  tutorArrival: "9:00 AM",
  tutorDeparture: "1:00 PM",
  blocks: [
    {
      sortOrder: 1,
      startTime: "09:00",
      durationMin: 25,
      subjectName: "Math",
      subjectEmoji: "+",
      title: "Fractions warm-up",
      description: "Add unlike fractions",
      curriculumTopicCode: "5.NF.1",
      bookPageRefs: [],
      printablesAttached: 0,
      lesson: {
        objectives: ["Add unlike fractions"],
        materials: ["Pencil", "Math notebook"],
        instructions: "Solve each problem and show work.",
        videos: [],
        worksheets: [
          {
            title: "Practice set A",
            description: "Five problems untimed",
            questions: [
              "WORKQONE plus one third equals",
              "WORKQTWO three quarters plus one sixth",
              "WORKQTHREE two fifths plus one fourth",
            ],
          },
        ],
        answerKey: "ANSKEY five sixths eleven twelfths thirteen twentieths",
      },
    },
  ],
  tutorNotesYesterday: null,
  schoolDayWindow: { start: "09:00", end: "13:00" },
};

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  // Dynamic import so the legacy build (Node-compatible) is used.
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (typeof (item as any).str === "string") {
        parts.push((item as any).str);
      }
    }
    parts.push("\n");
  }
  return parts.join(" ");
}

describe("nightly agenda packet — worksheets + answer keys (parsed PDF)", () => {
  it("renders all worksheet questions inline in the PDF (page 2+)", async () => {
    const r = await buildAgendaPdf(PAYLOAD);
    const text = await extractPdfText(r.pdfBuffer);
    expect(text).toContain("WORKQONE");
    expect(text).toContain("WORKQTWO");
    expect(text).toContain("WORKQTHREE");
  });

  it("renders the adult answer key inline in the PDF", async () => {
    const r = await buildAgendaPdf(PAYLOAD);
    const text = await extractPdfText(r.pdfBuffer);
    expect(text).toContain("ANSKEY");
    expect(text).toContain("Answer key (adult)");
  });

  it("renders the worksheet header and lesson page furniture (Materials + Instructions)", async () => {
    const r = await buildAgendaPdf(PAYLOAD);
    const text = await extractPdfText(r.pdfBuffer);
    expect(text).toContain("Worksheet");
    expect(text).toContain("Materials");
    expect(text).toContain("Instructions");
  });

  it("packet WITHOUT a lesson does NOT render the worksheet header or answer-key label", async () => {
    const noLesson: AgendaPdfInput = JSON.parse(JSON.stringify(PAYLOAD));
    noLesson.blocks[0].lesson = null;
    const r = await buildAgendaPdf(noLesson);
    const text = await extractPdfText(r.pdfBuffer);
    expect(text).not.toContain("Worksheet");
    expect(text).not.toContain("Answer key (adult)");
  });
});
