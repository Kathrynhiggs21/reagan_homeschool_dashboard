import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildAgendaPdf, type AgendaPdfInput } from "./_lib/agendaPdf";

const SRC = readFileSync(
  join(process.cwd(), "server/_lib/agendaPdf.ts"),
  "utf-8",
);

const BASE: AgendaPdfInput = {
  forDate: "2026-05-13",
  dayLabel: "Wednesday, May 13",
  studentName: "Reagan",
  blocks: [],
};

/**
 * pdfkit output is zlib-compressed for text streams, so we can't grep raw
 * bytes for "What to do". Instead we count `/Type /Page` objects to assert
 * page count, which is deterministic regardless of compression.
 */
function pageCount(buf: Buffer): number {
  // Match /Type /Page followed by a non-word character. pdfkit emits both
  // `/Type /Pages` (singular catalogue) and `/Type /Page` (each page); we
  // only want the latter.
  const txt = buf.toString("latin1");
  const re = /\/Type\s*\/Page\b(?!s)/g;
  const matches = txt.match(re) ?? [];
  return matches.length;
}

describe("Push 76 — agenda PDF renders generated payloads", () => {
  it("source contains the addendum-page block + inline-suppression conditions", () => {
    // Inline summary line on summary page is suppressed when description or
    // bookPageRefs exist.
    expect(SRC).toMatch(
      /if \(b\.generated && !b\.description && !\(b\.bookPageRefs && b\.bookPageRefs\.length > 0\)\)/,
    );
    // Addendum page is gated on generated AND not lesson (avoids double-render).
    expect(SRC).toMatch(/!!b\.generated && !b\.lesson/);
    // Addendum prints What to do / Supplies / Printable sections.
    expect(SRC).toContain('"What to do"');
    expect(SRC).toContain('"Supplies"');
    expect(SRC).toContain('"Printable"');
  });

  /**
   * Deltas only — we don't pin absolute page counts because pdfkit may
   * auto-paginate long content. We pin the EFFECT: adding a generated
   * payload to a block adds exactly one PDF page (the addendum).
   */
  async function baselineCount(extra: Partial<AgendaPdfInput["blocks"][0]> = {}): Promise<number> {
    const out = await buildAgendaPdf({
      ...BASE,
      blocks: [
        { sortOrder: 1, durationMin: 25, subjectName: "Math", title: "Math practice", ...extra },
      ],
    });
    return pageCount(out.pdfBuffer);
  }

  it("adding a generated payload (no lesson) increases the PDF by exactly one page", async () => {
    const baseline = await baselineCount();
    const withGen = await baselineCount({
      generated: {
        kind: "practice", title: "Math practice", instructions: ["Try problems 1-4"],
        printable: "Math: 4 problems", operable: { url: "https://www.khanacademy.org" },
      },
    });
    expect(withGen - baseline).toBe(1);
  });

  it("lesson AND generated does NOT add a duplicate page (only lesson page)", async () => {
    const justLesson = await baselineCount({
      lesson: { instructions: "Read p. 12", objectives: ["x"], materials: ["y"] },
    });
    const both = await baselineCount({
      lesson: { instructions: "Read p. 12", objectives: ["x"], materials: ["y"] },
      generated: { kind: "reading", title: "x", instructions: ["a"], printable: "p", operable: {} },
    });
    expect(both).toBe(justLesson);
  });

  it("two generated blocks add two addendum pages", async () => {
    const baseline = pageCount((await buildAgendaPdf({
      ...BASE,
      blocks: [
        { sortOrder: 1, durationMin: 25, subjectName: "Math", title: "a" },
        { sortOrder: 2, durationMin: 25, subjectName: "Adventure", title: "b" },
      ],
    })).pdfBuffer);
    const withGen = pageCount((await buildAgendaPdf({
      ...BASE,
      blocks: [
        { sortOrder: 1, durationMin: 25, subjectName: "Math", title: "a",
          generated: { kind: "practice", title: "x", instructions: ["a"], printable: "p", operable: {} }},
        { sortOrder: 2, durationMin: 25, subjectName: "Adventure", title: "b",
          generated: { kind: "adventure", title: "x", instructions: ["a"], printable: "p", operable: { supplyList: ["clipboard"] }}},
      ],
    })).pdfBuffer);
    expect(withGen - baseline).toBe(2);
  });

  it("agenda hash is stable when generated payload is added (back-compat)", async () => {
    const a = await buildAgendaPdf({
      ...BASE,
      blocks: [{ sortOrder: 1, durationMin: 25, subjectName: "Math", title: "Math practice" }],
    });
    const b = await buildAgendaPdf({
      ...BASE,
      blocks: [{
        sortOrder: 1, durationMin: 25, subjectName: "Math", title: "Math practice",
        generated: { kind: "practice", title: "x", instructions: ["a"], printable: "p", operable: {} },
      }],
    });
    expect(a.agendaHash).toBe(b.agendaHash);
  });
});
