/**
 * v3.31 (2026-06-04) — Nightly packet audit contract.
 */
import { describe, it, expect } from "vitest";
import {
  blockHasContent,
  auditPacket,
  formatAuditNotification,
  NON_CONTENT_BLOCK_TYPES,
} from "./_lib/packetAudit";
import type { AgendaPdfBlock } from "./_lib/agendaPdf";

function block(overrides: Partial<AgendaPdfBlock> = {}): AgendaPdfBlock {
  return {
    sortOrder: 1,
    startTime: "09:00",
    durationMin: 30,
    subjectName: "Math",
    subjectEmoji: null,
    title: "Math",
    description: null,
    curriculumTopicCode: null,
    curriculumTopicTitle: null,
    bookPageRefs: [],
    printablesAttached: 0,
    lesson: null,
    generated: null,
    ...overrides,
  } as AgendaPdfBlock;
}

describe("v3.31 — blockHasContent", () => {
  it("true when lesson has instructions", () => {
    expect(
      blockHasContent(
        block({ lesson: { instructions: "Do the thing", worksheets: [] } as any }),
      ),
    ).toBe(true);
  });

  it("true when a worksheet has questions", () => {
    expect(
      blockHasContent(
        block({
          lesson: {
            worksheets: [{ title: "W", questions: ["1+1?"] }],
          } as any,
        }),
      ),
    ).toBe(true);
  });

  it("true when a worksheet has a printable URL but no questions", () => {
    expect(
      blockHasContent(
        block({
          lesson: {
            worksheets: [{ title: "W", printableUrl: "https://x/y.pdf" }],
          } as any,
        }),
      ),
    ).toBe(true);
  });

  it("true when there is an answer key", () => {
    expect(
      blockHasContent(block({ lesson: { answerKey: "1. 2" } as any })),
    ).toBe(true);
  });

  it("true when a generated activity exists", () => {
    expect(
      blockHasContent(block({ generated: { kind: "video" } as any })),
    ).toBe(true);
  });

  it("true when book page refs exist", () => {
    expect(
      blockHasContent(
        block({
          bookPageRefs: [{ bookTitle: "Tuck", fromPage: 1, toPage: 5 }] as any,
        }),
      ),
    ).toBe(true);
  });

  it("false for a bare block (no lesson, no generated, no books)", () => {
    expect(blockHasContent(block())).toBe(false);
  });

  it("false when lesson exists but is entirely empty", () => {
    expect(
      blockHasContent(
        block({
          lesson: {
            instructions: "",
            objectives: [],
            worksheets: [],
            videos: [],
            answerKey: "",
          } as any,
        }),
      ),
    ).toBe(false);
  });
});

describe("v3.31 — auditPacket", () => {
  it("passes when every content block has content", () => {
    const blocks = [
      block({ sortOrder: 1, lesson: { instructions: "x" } as any }),
      block({ sortOrder: 2, generated: { kind: "adventure" } as any }),
    ];
    const types = new Map<number, string>([
      [1, "math"],
      [2, "read_aloud"],
    ]);
    const r = auditPacket("2026-06-05", blocks, types);
    expect(r.ok).toBe(true);
    expect(r.emptyBlocks.length).toBe(0);
    expect(r.contentBlocks).toBe(2);
  });

  it("flags an empty content block", () => {
    const blocks = [block({ sortOrder: 1, title: "Empty Math" })];
    const types = new Map<number, string>([[1, "math"]]);
    const r = auditPacket("2026-06-05", blocks, types);
    expect(r.ok).toBe(false);
    expect(r.emptyBlocks.length).toBe(1);
    expect(r.emptyBlocks[0].title).toBe("Empty Math");
    expect(r.emptyBlocks[0].sortOrder).toBe(1);
  });

  it("exempts appointment and adventure block types", () => {
    expect(NON_CONTENT_BLOCK_TYPES.has("appointment")).toBe(true);
    expect(NON_CONTENT_BLOCK_TYPES.has("adventure")).toBe(true);
    const blocks = [
      block({ sortOrder: 1, title: "Lunch" }),
      block({ sortOrder: 2, title: "Nature Walk" }),
    ];
    const types = new Map<number, string>([
      [1, "appointment"],
      [2, "adventure"],
    ]);
    const r = auditPacket("2026-06-05", blocks, types);
    // Both exempt → no content blocks counted, audit passes.
    expect(r.ok).toBe(true);
    expect(r.contentBlocks).toBe(0);
    expect(r.totalBlocks).toBe(2);
  });

  it("exempts the morning-vibe / Slay Charge mood-setter by block type", () => {
    expect(NON_CONTENT_BLOCK_TYPES.has("morning_vibe")).toBe(true);
    expect(NON_CONTENT_BLOCK_TYPES.has("morning_warmup")).toBe(true);
    const blocks = [
      block({ sortOrder: 1, title: "Slay Charge \u26A1" }),
      block({ sortOrder: 2, title: "Summer charge \u2600\uFE0F" }),
    ];
    const types = new Map<number, string>([
      [1, "morning_vibe"],
      [2, "morning_warmup"],
    ]);
    const r = auditPacket("2026-06-17", blocks, types);
    // Both exempt → no content blocks, no false-positive email.
    expect(r.ok).toBe(true);
    expect(r.contentBlocks).toBe(0);
    expect(r.emptyBlocks.length).toBe(0);
  });

  it("exempts the mood-setter by title even if saved under another type", () => {
    const blocks = [block({ sortOrder: 1, title: "Slay Charge \u26A1" })];
    // Deliberately NOT a known non-content type id.
    const types = new Map<number, string>([[1, "custom"]]);
    const r = auditPacket("2026-06-17", blocks, types);
    expect(r.ok).toBe(true);
    expect(r.contentBlocks).toBe(0);
    expect(r.emptyBlocks.length).toBe(0);
  });

  it("block type matching is case-insensitive", () => {
    const blocks = [block({ sortOrder: 1, title: "Lunch" })];
    const types = new Map<number, string>([[1, "APPOINTMENT"]]);
    const r = auditPacket("2026-06-05", blocks, types);
    expect(r.ok).toBe(true);
    expect(r.contentBlocks).toBe(0);
  });

  it("counts unknown-type blocks as content (fail-safe)", () => {
    const blocks = [block({ sortOrder: 1, title: "Mystery" })];
    const types = new Map<number, string>(); // no mapping
    const r = auditPacket("2026-06-05", blocks, types);
    expect(r.contentBlocks).toBe(1);
    expect(r.ok).toBe(false);
  });
});

describe("v3.31 — formatAuditNotification", () => {
  it("titles with the date and singular/plural counts", () => {
    const one = formatAuditNotification({
      forDate: "2026-06-05",
      totalBlocks: 1,
      contentBlocks: 1,
      ok: false,
      emptyBlocks: [
        { blockId: -1, sortOrder: 1, title: "Math", blockType: "math", reason: "r" },
      ],
    });
    expect(one.title).toContain("2026-06-05");
    expect(one.title).toContain("1 block");
    expect(one.title).not.toContain("1 blocks");
  });

  it("caps the listed blocks at 10 and adds an overflow line", () => {
    const empties = Array.from({ length: 13 }, (_, i) => ({
      blockId: -1,
      sortOrder: i + 1,
      title: `B${i + 1}`,
      blockType: "math",
      reason: "r",
    }));
    const msg = formatAuditNotification({
      forDate: "2026-06-05",
      totalBlocks: 13,
      contentBlocks: 13,
      ok: false,
      emptyBlocks: empties,
    });
    expect(msg.content).toContain("and 3 more");
    // Only 10 bullet lines.
    const bullets = msg.content.split("\n").filter((l) => l.startsWith("•"));
    expect(bullets.length).toBe(10);
  });
});
