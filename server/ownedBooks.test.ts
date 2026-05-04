import { describe, expect, it } from "vitest";
import { buildPromptMessages, type AIOwnedBookHint } from "./_lib/aiScheduleGenerator";

const baseInput = {
  dateStr: "2026-05-05",
  dayLabel: "Tuesday, May 5",
  studentName: "Reagan",
  gradeLevel: "5th grade",
  interests: ["birds"],
  whatWorks: ["short blocks"],
  whatHarms: ["over-correction"],
  subjects: [
    { slug: "math", name: "Math" },
    { slug: "ela", name: "ELA" },
    { slug: "science", name: "Science" },
  ],
};

const owned: AIOwnedBookHint[] = [
  {
    title: "Tuck Everlasting",
    type: "novel",
    subjectSlug: "ela",
    status: "not_started",
    suggestedPageSpan: null,
    currentChapter: 0,
    totalChapters: 25,
    topicCodes: ["RL.5.1", "RL.5.2"],
  },
  {
    title: "Michael's World",
    type: "chapter_book",
    subjectSlug: "ela",
    status: "in_progress",
    suggestedPageSpan: null,
    currentChapter: 31,
    totalChapters: 60,
  },
  {
    title: "Spectrum Science Grade 5",
    type: "workbook",
    subjectSlug: "science",
    status: "in_progress_unstructured",
    suggestedPageSpan: { from: 90, to: 91 },
    notes: "scattered pages already done; system skips them",
  },
  {
    title: "180 Days of Language Grade 5",
    type: "workbook",
    subjectSlug: "ela",
    status: "in_progress_unstructured",
    suggestedPageSpan: { from: 71, to: 72 },
    topicCodes: ["L.5.1", "L.5.2"],
  },
  {
    title: "Old Finished Book",
    type: "novel",
    subjectSlug: "ela",
    status: "done",
  },
  {
    title: "Shelved Reference",
    type: "reference",
    subjectSlug: "math",
    status: "shelved",
  },
];

describe("AI generator — owned books prompt", () => {
  it("includes every active owned book with the right page/chapter language", () => {
    const msgs = buildPromptMessages({ ...baseInput, ownedBooks: owned } as any);
    const sys = msgs[0].content as string;

    expect(sys).toContain("REAGAN'S OWNED PRINTED BOOKS");
    // Active books must be present
    expect(sys).toContain("Tuck Everlasting");
    expect(sys).toContain("Michael's World");
    expect(sys).toContain("Spectrum Science Grade 5");
    expect(sys).toContain("180 Days of Language Grade 5");
    // Workbooks reference the EXACT span we computed
    expect(sys).toMatch(/pages 90.{1,3}91/);
    expect(sys).toMatch(/pages 71.{1,3}72/);
    // Chapter book exposes the next chapter (server stores 0-indexed; UI/AI sees +1)
    expect(sys).toContain("Chapter 32");
    // Tuck Everlasting starts at chapter 1 ("Chapter 1")
    expect(sys).toContain("Chapter 1");
  });

  it("filters out done and shelved books", () => {
    const msgs = buildPromptMessages({ ...baseInput, ownedBooks: owned } as any);
    const sys = msgs[0].content as string;
    expect(sys).not.toContain("Old Finished Book");
    expect(sys).not.toContain("Shelved Reference");
  });

  it("emits an explicit phrasing rule for workbooks vs chapter books", () => {
    const msgs = buildPromptMessages({ ...baseInput, ownedBooks: owned } as any);
    const sys = msgs[0].content as string;
    expect(sys).toContain("OWNED-BOOK RULES");
    expect(sys).toContain("Complete pg. X");
    expect(sys).toContain("Read Chapter N");
  });

  it("falls back to a placeholder when no owned books are provided", () => {
    const msgs = buildPromptMessages({ ...baseInput } as any);
    const sys = msgs[0].content as string;
    expect(sys).toContain("(no owned-books context provided)");
  });
});
