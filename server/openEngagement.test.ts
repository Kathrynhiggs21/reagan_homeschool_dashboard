/**
 * openEngagement subject-inference test.
 *
 * We test the *pure mapping logic* (category + name → subject slug) by
 * extracting it locally in the test, mirroring the implementation in
 * routers.ts.  This keeps the test fast and avoids needing a live DB.
 *
 * If the production logic changes, this test should change with it.
 */
import { describe, it, expect } from "vitest";

function inferSubjectSlug(link: { name: string; description?: string | null; category: string }): string | null {
  const CAT_TO_SUBJECT: Record<string, string | null> = {
    learning: "math",
    reading: "ela",
    creativity: "ela",
    nature: "science",
    school: null,
    google: null,
    video: null,
  };
  const NAME_HINTS: Array<{ rx: RegExp; subject: string }> = [
    { rx: /math|ixl|prodigy/i, subject: "math" },
    { rx: /history|geo|social/i, subject: "ss" },
    { rx: /\bscience\b|mystery science|merlin|inatural/i, subject: "science" },
    { rx: /vocab|read|story|epic/i, subject: "ela" },
  ];
  let subjectSlug = CAT_TO_SUBJECT[link.category] ?? null;
  for (const h of NAME_HINTS) {
    if (h.rx.test(`${link.name} ${link.description ?? ""}`)) { subjectSlug = h.subject; break; }
  }
  return subjectSlug;
}

describe("appLinks.openEngagement subject inference", () => {
  it("maps reading category to ela", () => {
    expect(inferSubjectSlug({ name: "Storyline Online", category: "reading" })).toBe("ela");
  });
  it("maps creativity to ela by default", () => {
    expect(inferSubjectSlug({ name: "Adobe Express", category: "creativity" })).toBe("ela");
  });
  it("maps nature to science", () => {
    expect(inferSubjectSlug({ name: "Merlin Bird ID", category: "nature" })).toBe("science");
  });
  it("uses name hints to override learning -> math when name says reading", () => {
    expect(inferSubjectSlug({ name: "Vocabulary.com", category: "learning" })).toBe("ela");
  });
  it("uses name hints to keep math for IXL", () => {
    expect(inferSubjectSlug({ name: "IXL Learning", category: "learning" })).toBe("math");
  });
  it("returns null for school/google so we don\u2019t double-count", () => {
    expect(inferSubjectSlug({ name: "Google Classroom", category: "school" })).toBe(null);
    expect(inferSubjectSlug({ name: "Google Drive", category: "google" })).toBe(null);
  });
  it("history/geo names map to ss", () => {
    expect(inferSubjectSlug({ name: "Mystery History", category: "learning" })).toBe("ss");
    expect(inferSubjectSlug({ name: "GeoGuessr Kids", category: "learning" })).toBe("ss");
  });
});
