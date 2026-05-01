import { describe, it, expect } from "vitest";
import { findAllPrintablesForSubject } from "../client/src/lib/matchPrintable";

const mk = (id: number, opts: Partial<any> = {}): any => ({
  id, title: `Item ${id}`, source: "manus", status: "open", subjectSlug: null, bucket: "have_to_do",
  ...opts,
});

describe("findAllPrintablesForSubject", () => {
  it("returns matches by subject slug, ranked best-first, capped at limit", () => {
    const items = [
      mk(1, { subjectSlug: "math", title: "Fractions" }),
      mk(2, { subjectSlug: "math", title: "Decimals", bucket: "extra" }),
      mk(3, { subjectSlug: "ela", title: "Vocab quiz" }),
      mk(4, { subjectSlug: "math", title: "Algebra puzzle", bucket: "optional" }),
    ];
    const out = findAllPrintablesForSubject(items, "math", 3);
    expect(out.map(o => o.id)).toEqual([1, 4, 2]);
  });

  it("falls back to title sniff for items without explicit subject slug", () => {
    const items = [
      mk(1, { title: "Read Tuck Everlasting Ch 4", subjectSlug: null }),
      mk(2, { title: "Random extra", subjectSlug: null }),
    ];
    const out = findAllPrintablesForSubject(items, "ela", 5);
    expect(out.length).toBe(1);
    expect(out[0].id).toBe(1);
  });

  it("returns empty when no matches", () => {
    expect(findAllPrintablesForSubject([], "math")).toEqual([]);
    expect(findAllPrintablesForSubject([mk(1, { subjectSlug: "ela" })], "math")).toEqual([]);
  });

  it("respects the limit", () => {
    const items = [1,2,3,4,5,6].map(i => mk(i, { subjectSlug: "math", title: `Math ${i}` }));
    expect(findAllPrintablesForSubject(items, "math", 2)).toHaveLength(2);
    expect(findAllPrintablesForSubject(items, "math", 10)).toHaveLength(6);
  });
});
