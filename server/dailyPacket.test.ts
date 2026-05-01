import { describe, it, expect } from "vitest";
import {
  detectSubjectSlug,
  findAllPrintablesForSubject,
} from "../client/src/lib/matchPrintable";

/**
 * Integration-style sanity test for the Daily Packet adult page.
 *
 * The page composes detectSubjectSlug(block) -> findAllPrintablesForSubject(items, slug, 6)
 * to render a worksheet list under each block. These tests pin that contract so
 * a refactor of either helper can't silently break the packet.
 */
describe("DailyPacket integration helpers", () => {
  it("detectSubjectSlug uses subjectSlug verbatim when present", () => {
    expect(detectSubjectSlug({ subjectSlug: "math", title: "anything" })).toBe("math");
  });

  it("detectSubjectSlug sniffs from title when subjectSlug missing", () => {
    expect(detectSubjectSlug({ title: "Read Tuck Everlasting Ch 4" })).toBe("reading");
    expect(detectSubjectSlug({ title: "Decimal practice" })).toBe("math");
    expect(detectSubjectSlug({ title: "Nature walk" })).toBe("science");
  });

  it("findAllPrintablesForSubject caps to limit, prioritizes have_to_do, drops unrelated", () => {
    const items = [
      { id: 1, title: "Math worksheet A", subjectSlug: "math", bucket: "have_to_do", status: "todo" },
      { id: 2, title: "Math worksheet B", subjectSlug: "math", bucket: "optional", status: "todo" },
      { id: 3, title: "Math worksheet C", subjectSlug: "math", bucket: "extra", status: "todo" },
      { id: 4, title: "Random crossword", subjectSlug: null, bucket: "extra", status: "todo" },
    ] as any[];
    const result = findAllPrintablesForSubject(items, "math", 6);
    // 3 math worksheets, ordered by bucket priority. Random one excluded.
    expect(result.map((r: any) => r.id)).toEqual([1, 2, 3]);
  });

  it("returns empty list when slug is null", () => {
    expect(findAllPrintablesForSubject([{ id: 1, title: "x" } as any], null, 6)).toEqual([]);
  });
});
