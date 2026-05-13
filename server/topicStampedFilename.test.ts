import { describe, it, expect } from "vitest";
import { topicStampedFilename } from "./_lib/topicStampedFilename";

describe("topicStampedFilename \u2014 push 31", () => {
  it("matches the exact spec example", () => {
    expect(
      topicStampedFilename({
        topicCode: "5.OA.1",
        topicTitle: "Order of Operations",
        kind: "worksheet",
        ext: "pdf",
      }),
    ).toBe("5.OA.1__order-of-operations__worksheet.pdf");
  });

  it("produces 5.OA.1__order-of-ops shape from a fallback title", () => {
    expect(
      topicStampedFilename({
        topicCode: "5.OA.1",
        fallbackTitle: "order of ops",
        kind: "worksheet",
        ext: "pdf",
      }),
    ).toBe("5.OA.1__order-of-ops__worksheet.pdf");
  });

  it("preserves the dots in the standard code", () => {
    const out = topicStampedFilename({
      topicCode: "5.NBT.5",
      topicTitle: "Multi-digit multiplication",
      kind: "answer-key",
      ext: "pdf",
    });
    expect(out.startsWith("5.NBT.5__")).toBe(true);
    expect(out.endsWith("__answer-key.pdf")).toBe(true);
  });

  it("strips unsafe filesystem chars from the code", () => {
    const out = topicStampedFilename({
      topicCode: "5.OA.1/../../etc",
      topicTitle: "Order of Operations",
      kind: "worksheet",
      ext: "pdf",
    });
    // The slashes are stripped but dots are kept; what matters is no slash leaks through.
    expect(out).not.toContain("/");
    expect(out.startsWith("5.OA.1")).toBe(true);
    expect(out.endsWith("__order-of-operations__worksheet.pdf")).toBe(true);
  });

  it("falls back to slug-only when code is missing", () => {
    expect(
      topicStampedFilename({
        topicTitle: "Free draw",
        kind: "lesson",
        ext: "pdf",
      }),
    ).toBe("free-draw__lesson.pdf");
  });

  it("falls back to 'untitled' when both title sources are empty", () => {
    expect(
      topicStampedFilename({
        kind: "worksheet",
        ext: "pdf",
      }),
    ).toBe("untitled__worksheet.pdf");
  });

  it("supports png/docx/md extensions", () => {
    expect(
      topicStampedFilename({
        topicCode: "5.G.2",
        topicTitle: "Coordinate plane",
        kind: "ref",
        ext: "png",
      }),
    ).toBe("5.G.2__coordinate-plane__ref.png");
    expect(
      topicStampedFilename({
        topicCode: "5.RL.5.1",
        topicTitle: "Quote textual evidence",
        kind: "lesson",
        ext: "md",
      }),
    ).toBe("5.RL.5.1__quote-textual-evidence__lesson.md");
  });
});
