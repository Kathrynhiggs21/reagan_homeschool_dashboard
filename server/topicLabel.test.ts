import { describe, it, expect } from "vitest";
import { SUBJECT_META, subjectMeta } from "../client/src/components/TopicLabel";

describe("TopicLabel: subject meta", () => {
  it("returns labelled meta for known slugs", () => {
    expect(subjectMeta("math").label).toBe("Math");
    expect(subjectMeta("science").label).toBe("Science");
    expect(subjectMeta("ela").label).toMatch(/Reading/);
  });

  it("falls back to a neutral default for unknown slug", () => {
    const m = subjectMeta("zzz_unknown");
    expect(m.label).toBe("zzz_unknown");
    expect(m.emoji).toBeTruthy();
  });

  it("returns generic Topic label when slug missing", () => {
    expect(subjectMeta(null).label).toBe("Topic");
    expect(subjectMeta(undefined).label).toBe("Topic");
  });

  it("covers all major homeschool subjects", () => {
    for (const slug of ["math", "ela", "science", "ss", "art", "music", "pe", "outdoors", "wonder"]) {
      expect(SUBJECT_META[slug]).toBeDefined();
    }
  });
});
