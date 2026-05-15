import { describe, it, expect } from "vitest";
import {
  buildPrintableDailyPack,
  type AgendaBlockForPack,
} from "./_lib/printableDailyPackBuilder";

const ISO = "2026-05-15";

function mkBlock(overrides: Partial<AgendaBlockForPack> = {}): AgendaBlockForPack {
  return {
    id: 1,
    title: "Math warm-up",
    subjectSlug: "math",
    status: "not_started",
    estimatedMinutes: 20,
    worksheetPdfUrl: null,
    worksheetPdfName: null,
    lessonPdfUrl: null,
    lessonPdfName: null,
    printedBookRef: null,
    notes: null,
    ...overrides,
  };
}

describe("printableDailyPackBuilder — house rules", () => {
  it("returns an empty pack for no blocks (no throw)", () => {
    const pack = buildPrintableDailyPack({ isoDate: ISO, blocks: [] });
    expect(pack.scheduleRows).toHaveLength(0);
    expect(pack.worksheetList).toHaveLength(0);
    expect(pack.lessonList).toHaveLength(0);
    expect(pack.tutorHandoff.stillOnPlate).toHaveLength(0);
    expect(pack.tutorHandoff.summaryLine.toLowerCase()).toContain("plate is clear");
    expect(pack.scheduleHeader.estimatedTotalMinutes).toBe(0);
  });

  it("kidNote and adultNote use calm voice with no forbidden words", () => {
    const pack = buildPrintableDailyPack({ isoDate: ISO, blocks: [] });
    const forbidden = /buddy|friend|yay|woohoo|great job|awesome/i;
    expect(pack.scheduleHeader.kidNote).not.toMatch(forbidden);
    expect(pack.scheduleHeader.adultNote).not.toMatch(forbidden);
    // adultNote MUST flag estimates as non-enforced
    expect(pack.scheduleHeader.adultNote.toLowerCase()).toContain("not enforced");
  });

  it("aggregates estimatedTotalMinutes across blocks", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [
        mkBlock({ id: 1, estimatedMinutes: 20 }),
        mkBlock({ id: 2, estimatedMinutes: 15 }),
        mkBlock({ id: 3, estimatedMinutes: null }),
      ],
    });
    expect(pack.scheduleHeader.estimatedTotalMinutes).toBe(35);
  });

  it("clamps estimatedMinutes to [0, 240] and rounds", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [
        mkBlock({ id: 1, estimatedMinutes: -10 }),
        mkBlock({ id: 2, estimatedMinutes: 500 }),
        mkBlock({ id: 3, estimatedMinutes: 17.6 }),
      ],
    });
    expect(pack.scheduleRows[0].estimatedMinutes).toBe(0);
    expect(pack.scheduleRows[1].estimatedMinutes).toBe(240);
    expect(pack.scheduleRows[2].estimatedMinutes).toBe(18);
  });

  it("includes worksheet entries for PDF-backed blocks", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [
        mkBlock({
          id: 1,
          title: "Language",
          worksheetPdfUrl: "/manus-storage/lang.pdf",
          worksheetPdfName: "Language pg 12",
        }),
      ],
    });
    expect(pack.worksheetList).toHaveLength(1);
    expect(pack.worksheetList[0].href).toBe("/manus-storage/lang.pdf");
    expect(pack.worksheetList[0].label).toBe("Language pg 12");
  });

  it("includes printed-book worksheet entries with page line", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [
        mkBlock({
          id: 1,
          title: "Reading",
          printedBookRef: { book: "Tuck Everlasting", pages: "47-52" },
        }),
      ],
    });
    expect(pack.worksheetList).toHaveLength(1);
    expect(pack.worksheetList[0].printedBookLine).toBe(
      "Tuck Everlasting — pg 47-52",
    );
    expect(pack.worksheetList[0].href).toBeNull();
  });

  it("includes lesson entries only for blocks with lessonPdfUrl", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [
        mkBlock({
          id: 1,
          title: "Read-aloud",
          lessonPdfUrl: "/manus-storage/read.pdf",
          lessonPdfName: "Today's read-aloud",
        }),
        mkBlock({ id: 2, title: "Math" }),
      ],
    });
    expect(pack.lessonList).toHaveLength(1);
    expect(pack.lessonList[0].blockId).toBe(1);
  });

  it("tutor handoff says 'plate is clear' when all blocks complete/skipped", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [
        mkBlock({ id: 1, status: "complete" }),
        mkBlock({ id: 2, status: "skipped" }),
      ],
    });
    expect(pack.tutorHandoff.stillOnPlate).toHaveLength(0);
    expect(pack.tutorHandoff.summaryLine.toLowerCase()).toContain("plate is clear");
  });

  it("tutor handoff lists in-progress and not-started as still on plate", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [
        mkBlock({ id: 1, title: "Math", status: "not_started" }),
        mkBlock({ id: 2, title: "Writing", status: "in_progress" }),
        mkBlock({ id: 3, title: "Science", status: "complete" }),
      ],
    });
    expect(pack.tutorHandoff.stillOnPlate).toEqual(["Math", "Writing"]);
    expect(pack.tutorHandoff.summaryLine).toContain("2 blocks");
  });

  it("tutor handoff handles singular block count", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [mkBlock({ id: 1, status: "not_started" })],
    });
    expect(pack.tutorHandoff.summaryLine).toContain("1 block ");
    expect(pack.tutorHandoff.summaryLine).not.toContain("1 blocks");
  });

  it("tutor handoff filters out forbidden punitive notes", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [
        mkBlock({ id: 1, notes: "She's behind on this one." }),
        mkBlock({ id: 2, notes: "Calm focus today — went well." }),
        mkBlock({ id: 3, notes: "Didn't do the worksheet." }),
      ],
    });
    expect(pack.tutorHandoff.notesForTutor).toHaveLength(1);
    expect(pack.tutorHandoff.notesForTutor[0]).toContain("Calm focus");
  });

  it("includes tutor name in summary when provided", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [mkBlock({ id: 1 })],
      tutorName: "Grandma Marcy",
    });
    expect(pack.tutorHandoff.summaryLine).toContain("Grandma Marcy");
  });

  it("uses 'No tutor assigned today' when tutorName is missing", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [mkBlock({ id: 1 })],
    });
    expect(pack.tutorHandoff.summaryLine).toContain("No tutor assigned");
  });

  it("untitled blocks get a safe fallback title", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [mkBlock({ id: 1, title: "" })],
    });
    expect(pack.scheduleRows[0].title).toBe("Untitled block");
  });

  it("never returns a worksheet entry that has neither href nor printedBookLine when the block has neither", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [mkBlock({ id: 1 })],
    });
    expect(pack.worksheetList).toHaveLength(0);
  });

  it("is deterministic — same input twice → same output", () => {
    const args = {
      isoDate: ISO,
      blocks: [
        mkBlock({ id: 1, status: "not_started" as const }),
        mkBlock({
          id: 2,
          status: "complete" as const,
          worksheetPdfUrl: "/manus-storage/x.pdf",
        }),
      ],
      tutorName: "Mom",
    };
    const a = buildPrintableDailyPack(args);
    const b = buildPrintableDailyPack(args);
    expect(a).toEqual(b);
  });

  it("handles malformed blocks input (non-array) without throwing", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: undefined as unknown as AgendaBlockForPack[],
    });
    expect(pack.scheduleRows).toHaveLength(0);
  });

  it("scheduleHeader.title contains the isoDate", () => {
    const pack = buildPrintableDailyPack({ isoDate: ISO, blocks: [] });
    expect(pack.scheduleHeader.title).toContain(ISO);
  });

  it("non-finite estimatedMinutes is treated as null", () => {
    const pack = buildPrintableDailyPack({
      isoDate: ISO,
      blocks: [mkBlock({ id: 1, estimatedMinutes: Number.NaN })],
    });
    expect(pack.scheduleRows[0].estimatedMinutes).toBeNull();
    expect(pack.scheduleHeader.estimatedTotalMinutes).toBe(0);
  });
});
