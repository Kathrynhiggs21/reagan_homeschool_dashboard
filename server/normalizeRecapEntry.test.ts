import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizeRecapEntry,
  normalizeRecapEntries,
  isNothingHappenedReply,
  clampReplyText,
  VALID_SUBJECT_SLUGS,
  MAX_MINUTES_PER_ENTRY,
  MAX_REPLY_TEXT_LENGTH,
} from "./_lib/normalizeRecapEntry";

describe("normalizeRecapEntry — subject slug aliasing", () => {
  it("accepts canonical slugs as-is", () => {
    for (const slug of VALID_SUBJECT_SLUGS) {
      const r = normalizeRecapEntry({ subjectSlug: slug, topic: "x", minutesSpent: 10 });
      expect(r?.subjectSlug).toBe(slug);
    }
  });

  it("aliases common LLM variants to canonical slugs", () => {
    const cases = [
      { in: "Math", want: "math" },
      { in: "Reading", want: "ela" },
      { in: "english-language-arts", want: "ela" },
      { in: "history", want: "social-studies" },
      { in: "Social Studies", want: "social-studies" },
      { in: "PE", want: "pe" },
      { in: "physical-education", want: "pe" },
      { in: "SEL", want: "social-emotional" },
      { in: "Life Skills", want: "life-skills" },
    ];
    for (const c of cases) {
      const r = normalizeRecapEntry({ subjectSlug: c.in, topic: "x", minutesSpent: 10 });
      expect(r?.subjectSlug).toBe(c.want);
    }
  });

  it("falls back to 'other' for unknown slugs (never drops the entry)", () => {
    const r = normalizeRecapEntry({ subjectSlug: "interpretive-dance-philosophy", topic: "x", minutesSpent: 10 });
    expect(r?.subjectSlug).toBe("other");
  });
});

describe("normalizeRecapEntry — minutes clamping", () => {
  it("clamps negative minutes to 0", () => {
    const r = normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: -50 });
    expect(r?.minutesSpent).toBe(0);
  });

  it("clamps absurd minutes (>720) to MAX_MINUTES_PER_ENTRY", () => {
    const r = normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: 9999 });
    expect(r?.minutesSpent).toBe(MAX_MINUTES_PER_ENTRY);
  });

  it("accepts numeric strings for minutesSpent", () => {
    const r = normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: "30" });
    expect(r?.minutesSpent).toBe(30);
  });

  it("falls back to 0 for non-numeric minutesSpent", () => {
    const r = normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: "a lot" });
    expect(r?.minutesSpent).toBe(0);
  });
});

describe("normalizeRecapEntry — topic guards", () => {
  it("rejects empty topic (returns null)", () => {
    expect(normalizeRecapEntry({ subjectSlug: "math", topic: "", minutesSpent: 10 })).toBeNull();
    expect(normalizeRecapEntry({ subjectSlug: "math", topic: "   ", minutesSpent: 10 })).toBeNull();
  });

  it("clamps overlong topic", () => {
    const long = "x".repeat(2000);
    const r = normalizeRecapEntry({ subjectSlug: "math", topic: long, minutesSpent: 10 });
    expect(r?.topic.length).toBe(500);
  });
});

describe("normalizeRecapEntry — notes & offPlan coercion", () => {
  it("accepts null/empty/undefined notes", () => {
    expect(normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: 10, notes: "" })?.notes).toBeNull();
    expect(normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: 10 })?.notes).toBeNull();
  });

  it("clamps overlong notes to 2000 chars", () => {
    const long = "n".repeat(5000);
    const r = normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: 10, notes: long });
    expect(r?.notes?.length).toBe(2000);
  });

  it("coerces offPlan from various truthy values", () => {
    expect(normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: 10, offPlan: true })?.offPlan).toBe(true);
    expect(normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: 10, offPlan: "true" })?.offPlan).toBe(true);
    expect(normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: 10, offPlan: 1 })?.offPlan).toBe(true);
    expect(normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: 10, offPlan: false })?.offPlan).toBe(false);
    expect(normalizeRecapEntry({ subjectSlug: "math", topic: "x", minutesSpent: 10 })?.offPlan).toBe(false);
  });
});

describe("normalizeRecapEntries — array handling", () => {
  it("returns [] for non-array input", () => {
    expect(normalizeRecapEntries(null)).toEqual([]);
    expect(normalizeRecapEntries(undefined)).toEqual([]);
    expect(normalizeRecapEntries("string")).toEqual([]);
    expect(normalizeRecapEntries({ entries: "wrong" })).toEqual([]);
  });

  it("drops null/non-object items", () => {
    const r = normalizeRecapEntries([null, "string", 42, { subjectSlug: "math", topic: "valid", minutesSpent: 10 }]);
    expect(r.length).toBe(1);
  });

  it("drops items with empty topic but keeps the rest", () => {
    const r = normalizeRecapEntries([
      { subjectSlug: "math", topic: "", minutesSpent: 10 },
      { subjectSlug: "ela", topic: "Read Tuck", minutesSpent: 25 },
    ]);
    expect(r.length).toBe(1);
    expect(r[0].topic).toBe("Read Tuck");
  });
});

describe("isNothingHappenedReply — short-circuit detection", () => {
  it("detects common 'nothing happened' replies", () => {
    expect(isNothingHappenedReply("nothing today")).toBe(true);
    expect(isNothingHappenedReply("Nothing happened.")).toBe(true);
    expect(isNothingHappenedReply("we just rested")).toBe(true);
    expect(isNothingHappenedReply("We took the day off")).toBe(true);
    expect(isNothingHappenedReply("a sick day")).toBe(true);
    expect(isNothingHappenedReply("Reagan was sick")).toBe(true);
    expect(isNothingHappenedReply("no school today")).toBe(true);
    expect(isNothingHappenedReply("off day")).toBe(true);
    expect(isNothingHappenedReply("skipped today")).toBe(true);
    expect(isNothingHappenedReply("break day")).toBe(true);
  });

  it("does NOT match real recap replies", () => {
    expect(isNothingHappenedReply("Reagan did 30 mins of math and read a chapter")).toBe(false);
    expect(isNothingHappenedReply("She finished her science worksheet")).toBe(false);
    expect(isNothingHappenedReply("")).toBe(false);
  });
});

describe("clampReplyText — DoS guard", () => {
  it("returns text unchanged when under cap", () => {
    expect(clampReplyText("hello")).toBe("hello");
  });

  it("clamps text over MAX_REPLY_TEXT_LENGTH", () => {
    const huge = "a".repeat(MAX_REPLY_TEXT_LENGTH + 1000);
    expect(clampReplyText(huge).length).toBe(MAX_REPLY_TEXT_LENGTH);
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error testing runtime safety
    expect(clampReplyText(null)).toBe("");
  });
});

describe("recap-reply route wiring", () => {
  const src = readFileSync(resolve(__dirname, "scheduledSync.ts"), "utf8");

  it("imports normalize helpers", () => {
    expect(src).toMatch(/normalizeRecapEntries/);
    expect(src).toMatch(/isNothingHappenedReply/);
    expect(src).toMatch(/clampReplyText/);
  });

  it("short-circuits nothing-happened replies before LLM call", () => {
    expect(src).toMatch(/if \(isNothingHappenedReply\(replyText\)\)/);
    expect(src).toMatch(/source: "nothing-happened"/);
  });

  it("clamps replyText before LLM call", () => {
    expect(src).toMatch(/clampReplyText\(String\(req\.body\?\.replyText/);
  });

  it("uses normalizeRecapEntries to replace blind Array.isArray", () => {
    expect(src).toMatch(/parsed = normalizeRecapEntries\(obj\?\.entries\)/);
  });
});
