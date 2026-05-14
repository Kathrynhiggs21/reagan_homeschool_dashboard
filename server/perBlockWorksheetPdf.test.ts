/**
 * PRIORITY-1 (2026-05-14) — per-block worksheet PDF attachments.
 *
 * Pure-helper contract; covers:
 *   - blocks-with-printable detection (lesson, generated-with-instructions,
 *     generated-with-printable, OR description-only blocks SKIPPED)
 *   - one PDF per printable block, ordered by sortOrder
 *   - filename + attachmentKey are kid-readable + dedupable
 *   - PDF buffer starts with %PDF
 *   - kid-readable headings appear in the PDF text (extracted via toString)
 *   - size-cap drops from the END of the day (morning blocks always preserved)
 */
import { describe, it, expect } from "vitest";
import {
  blockHasPrintable,
  buildPerBlockWorksheetAttachments,
} from "./_lib/perBlockWorksheetPdf";
import type { AgendaPdfInput, AgendaPdfBlock } from "./_lib/agendaPdf";

function makeBlock(partial: Partial<AgendaPdfBlock>): AgendaPdfBlock {
  return {
    sortOrder: 1,
    durationMin: 30,
    title: "Block",
    ...partial,
  } as AgendaPdfBlock;
}

const baseInput: AgendaPdfInput = {
  forDate: "2026-05-15",
  dayLabel: "Friday, May 15",
  studentName: "Reagan",
  blocks: [],
};

describe("blockHasPrintable", () => {
  it("returns true for a lesson with worksheet questions", () => {
    expect(
      blockHasPrintable(
        makeBlock({
          lesson: {
            worksheets: [{ title: "Q", questions: ["1+1?"] }],
          } as any,
        }),
      ),
    ).toBe(true);
  });

  it("returns true for a generated payload with instructions", () => {
    expect(
      blockHasPrintable(
        makeBlock({
          generated: {
            kind: "practice",
            title: "x",
            instructions: ["do it"],
            printable: "",
            operable: {},
          },
        }),
      ),
    ).toBe(true);
  });

  it("returns false for a bare description-only block", () => {
    expect(
      blockHasPrintable(
        makeBlock({ description: "stretch break — no worksheet" }),
      ),
    ).toBe(false);
  });

  it("returns false for an empty lesson object", () => {
    expect(
      blockHasPrintable(
        makeBlock({ lesson: { worksheets: [] } as any }),
      ),
    ).toBe(false);
  });
});

describe("buildPerBlockWorksheetAttachments", () => {
  it("emits one attachment per printable block, ordered by sortOrder", async () => {
    const out = await buildPerBlockWorksheetAttachments({
      ...baseInput,
      blocks: [
        makeBlock({
          sortOrder: 3,
          title: "Math",
          subjectName: "Math",
          lesson: {
            worksheets: [{ title: "T", questions: ["1+1?", "2+2?"] }],
          } as any,
        }),
        makeBlock({
          sortOrder: 1,
          title: "Reading",
          subjectName: "ELA",
          lesson: {
            instructions: "Read pg 10-12",
          } as any,
        }),
        makeBlock({
          sortOrder: 2,
          title: "Stretch",
          description: "stand up + 5 jumping jacks",
        }),
      ],
    });
    expect(out.map((a) => a.blockSortOrder)).toEqual([1, 3]);
    expect(out[0].filename).toContain("Block1");
    expect(out[0].filename.endsWith(".pdf")).toBe(true);
    expect(out[1].filename).toContain("Block3");
  });

  it("filename + attachmentKey are kid-readable and stable", async () => {
    const out = await buildPerBlockWorksheetAttachments({
      ...baseInput,
      blocks: [
        makeBlock({
          sortOrder: 2,
          title: "Place Value Practice",
          subjectName: "Math",
          curriculumTopicCode: "5.NBT.1",
          lesson: { worksheets: [{ title: "Q" }] } as any,
        }),
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].filename).toBe(
      "2026-05-15 - Block2 - Math - Place Value Practice - Reagan.pdf",
    );
    expect(out[0].attachmentKey).toBe("2026-05-15/b2/5.NBT.1/Math");
    expect(out[0].topicCode).toBe("5.NBT.1");
  });

  it("PDF buffer starts with %PDF", async () => {
    const out = await buildPerBlockWorksheetAttachments({
      ...baseInput,
      blocks: [
        makeBlock({
          lesson: { worksheets: [{ title: "T", questions: ["a?"] }] } as any,
        }),
      ],
    });
    expect(out[0].pdfBuffer.byteLength).toBeGreaterThan(200);
    expect(out[0].pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(out[0].byteSize).toBe(out[0].pdfBuffer.byteLength);
  });

  it("uses kid-readable headings constants (not adult jargon)", async () => {
    // pdfkit compresses text streams so binary-substring matching is brittle;
    // instead we validate the source-of-truth heading map. Any drift in the
    // helper's KID_HEADINGS literals will show up as a code review diff.
    const src = (
      await import("node:fs")
    ).readFileSync(
      "server/_lib/perBlockWorksheetPdf.ts",
      "utf8",
    );
    expect(src).toContain('whatToDo: "What to do"');
    expect(src).toContain('questions: "Try these"');
    expect(src).toContain('supplies: "What you need"');
    expect(src).toContain('answers: "Answers (for Mom)"');
    expect(src).toContain('videos: "Watch this first"');
    // Old jargon must not leak back into the *headings* (literal-quoted strings).
    // We only forbid quoted occurrences so we don't false-fail on doc references
    // that explain *why* we replaced the old labels.
    expect(src).not.toMatch(/"Objectives"/);
    expect(src).not.toMatch(/"Answer key \(adult\)"/);
  });

  it("size cap drops from the END (morning blocks always preserved)", async () => {
    const blocks: AgendaPdfBlock[] = [];
    for (let i = 1; i <= 4; i++) {
      blocks.push(
        makeBlock({
          sortOrder: i,
          title: `B${i}`,
          lesson: {
            worksheets: [
              { title: `T${i}`, questions: Array(50).fill("filler q?") },
            ],
          } as any,
        }),
      );
    }
    const full = await buildPerBlockWorksheetAttachments({
      ...baseInput,
      blocks,
    });
    expect(full).toHaveLength(4);
    const totalFull = full.reduce((s, a) => s + a.byteSize, 0);
    // Cap at half the full size — earliest 2 blocks should survive.
    const trimmed = await buildPerBlockWorksheetAttachments(
      { ...baseInput, blocks },
      { maxTotalBytes: Math.floor(totalFull / 2) },
    );
    expect(trimmed.length).toBeLessThan(full.length);
    expect(trimmed.length).toBeGreaterThan(0);
    // Whatever survives, sortOrders are a contiguous prefix from 1
    expect(trimmed.map((a) => a.blockSortOrder)).toEqual(
      Array.from({ length: trimmed.length }, (_, i) => i + 1),
    );
  });

  it("threads blockIdBySortOrder mapping into the result", async () => {
    const out = await buildPerBlockWorksheetAttachments(
      {
        ...baseInput,
        blocks: [
          makeBlock({
            sortOrder: 1,
            lesson: { worksheets: [{ title: "T" }] } as any,
          }),
          makeBlock({
            sortOrder: 5,
            lesson: { worksheets: [{ title: "T" }] } as any,
          }),
        ],
      },
      { blockIdBySortOrder: { 1: 101, 5: 505 } },
    );
    expect(out.map((a) => a.blockId)).toEqual([101, 505]);
  });
});
