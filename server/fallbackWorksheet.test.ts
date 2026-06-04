/**
 * v3.31 (2026-06-04) — Deterministic fallback worksheet contract.
 *
 * Hard requirement: a content block must NEVER print empty. Every subject
 * must yield >=3 questions AND a non-empty answer key, deterministically.
 */
import { describe, it, expect } from "vitest";
import {
  fallbackWorksheetForBlock,
  type FallbackInput,
} from "./_lib/fallbackWorksheet";

const SUBJECT_SLUGS = [
  "math",
  "ela",
  "reading",
  "writing",
  "science",
  "social-studies",
  "spelling",
  "pe-movement", // → general
  "", // → general
  null,
];

function base(overrides: Partial<FallbackInput> = {}): FallbackInput {
  return {
    blockId: 101,
    blockTitle: "Morning Math",
    subjectSlug: "math",
    durationMin: 30,
    dateStr: "2026-06-05",
    ...overrides,
  };
}

describe("v3.31 — fallbackWorksheetForBlock", () => {
  it("every subject produces >=3 questions and a non-empty answer key", () => {
    for (const slug of SUBJECT_SLUGS) {
      const lesson = fallbackWorksheetForBlock(
        base({ subjectSlug: slug as any, blockTitle: `Block ${slug}` }),
      );
      const ws = lesson.worksheets?.[0];
      expect(ws, `worksheet for ${slug}`).toBeTruthy();
      expect(
        (ws?.questions ?? []).length,
        `question count for ${slug}`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        (lesson.answerKey ?? "").trim().length,
        `answer key for ${slug}`,
      ).toBeGreaterThan(0);
    }
  });

  it("answer key has one line per question", () => {
    const lesson = fallbackWorksheetForBlock(base({ subjectSlug: "math" }));
    const qCount = lesson.worksheets?.[0]?.questions?.length ?? 0;
    const keyLines = (lesson.answerKey ?? "").split("\n").filter(Boolean);
    expect(keyLines.length).toBe(qCount);
  });

  it("is deterministic for the same (date, blockId, subject)", () => {
    const a = fallbackWorksheetForBlock(base());
    const b = fallbackWorksheetForBlock(base());
    expect(a.worksheets?.[0]?.questions).toEqual(b.worksheets?.[0]?.questions);
    expect(a.answerKey).toBe(b.answerKey);
  });

  it("varies across different days", () => {
    const day1 = fallbackWorksheetForBlock(base({ dateStr: "2026-06-05" }));
    const day2 = fallbackWorksheetForBlock(base({ dateStr: "2026-06-08" }));
    // Math items are randomized, so at least the questions should differ.
    expect(day1.worksheets?.[0]?.questions).not.toEqual(
      day2.worksheets?.[0]?.questions,
    );
  });

  it("stamps the Ohio standard code into description + instructions", () => {
    const lesson = fallbackWorksheetForBlock(
      base({ standardCode: "5.NBT.5" }),
    );
    expect(lesson.instructions).toContain("5.NBT.5");
    expect(lesson.worksheets?.[0]?.description).toContain("5.NBT.5");
  });

  it("omits the standard line when no code is given", () => {
    const lesson = fallbackWorksheetForBlock(base({ standardCode: null }));
    expect(lesson.instructions).not.toContain("Aligned to Ohio Learning Standard");
  });

  it("item count scales with duration (short→3, long→5)", () => {
    const short = fallbackWorksheetForBlock(base({ durationMin: 15 }));
    const long = fallbackWorksheetForBlock(base({ durationMin: 60 }));
    expect(short.worksheets?.[0]?.questions?.length).toBe(3);
    expect(long.worksheets?.[0]?.questions?.length).toBe(5);
  });

  it("never throws on hostile input", () => {
    expect(() =>
      fallbackWorksheetForBlock({
        blockId: 0,
        blockTitle: "",
        subjectSlug: undefined as any,
        durationMin: -5 as any,
        dateStr: "not-a-date",
      }),
    ).not.toThrow();
  });

  it("instructions clearly state no screen/login is needed (offline-safe)", () => {
    const lesson = fallbackWorksheetForBlock(base());
    expect((lesson.instructions ?? "").toLowerCase()).toContain("offline");
  });

  it("spelling produces real dictionary words as answers", () => {
    const lesson = fallbackWorksheetForBlock(
      base({ subjectSlug: "spelling", blockTitle: "Spelling" }),
    );
    const key = lesson.answerKey ?? "";
    // At least one known word from the bank should appear as an answer.
    expect(/necessary|separate|beginning|rhythm|weird|privilege/.test(key)).toBe(
      true,
    );
  });
});
