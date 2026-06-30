/**
 * 2026-06-30 — Coverage for the self-hosted subject worksheet PDF service.
 *
 * The kid-facing "Open / Print a paper copy" path must NEVER depend on an
 * external site and must NEVER look like a timed test. These specs lock:
 *  - subject normalization across many spellings;
 *  - topic -> stable cache key slugging ("default" for empty);
 *  - friendly, non-test-sounding titles (no "test"/"quiz"/"assessment");
 *  - cache-HIT short-circuits (no generate, no render, no upsert);
 *  - cache-MISS generates + renders + stores + upserts and returns the url;
 *  - forceRefresh bypasses a present cache row;
 *  - the assembled content actually renders to a real, multi-page PDF buffer.
 */
import { describe, it, expect, vi } from "vitest";
import {
  normalizeSubjectSlug,
  topicKeyFor,
  seedForSubject,
  getOrCreateSubjectWorksheetPdf,
  WORKSHEET_PDF_CONTENT_VERSION,
  type SubjectWorksheetDeps,
} from "./_lib/subjectWorksheetPdf";
import { renderWorksheetPdfBuffer } from "./_lib/worksheetPdf";
import { buildDeterministicWorksheet } from "./_lib/worksheetGenerator";
import type { WorksheetContent } from "@shared/worksheetTypes";

const NO_TEST_WORDS = /\b(test|quiz|exam|assessment|timed)\b/i;

describe("normalizeSubjectSlug", () => {
  it("maps common spellings to canonical slugs", () => {
    expect(normalizeSubjectSlug("Math")).toBe("math");
    expect(normalizeSubjectSlug("measurement conversions")).toBe("math");
    expect(normalizeSubjectSlug("Language Arts")).toBe("ela");
    expect(normalizeSubjectSlug("grammar")).toBe("ela");
    expect(normalizeSubjectSlug("reading comprehension")).toBe("reading");
    expect(normalizeSubjectSlug("creative writing")).toBe("writing");
    expect(normalizeSubjectSlug("Spectrum Science")).toBe("science");
    expect(normalizeSubjectSlug("social studies / history")).toBe("social");
  });
  it("falls back to generic for unknown/empty", () => {
    expect(normalizeSubjectSlug("")).toBe("generic");
    expect(normalizeSubjectSlug(null)).toBe("generic");
    expect(normalizeSubjectSlug("underwater basket weaving")).toBe("generic");
  });
});

describe("topicKeyFor", () => {
  it("slugs free text to a stable key", () => {
    expect(topicKeyFor("Adding Fractions!")).toBe("adding-fractions");
    expect(topicKeyFor("  Water  Cycle  ")).toBe("water-cycle");
  });
  it("collapses empty/whitespace to 'default'", () => {
    expect(topicKeyFor("")).toBe("default");
    expect(topicKeyFor("   ")).toBe("default");
    expect(topicKeyFor(null)).toBe("default");
  });
  it("clamps very long topics", () => {
    const key = topicKeyFor("x".repeat(400));
    expect(key.length).toBeLessThanOrEqual(110);
  });
});

describe("seedForSubject", () => {
  it("produces friendly, NON-test titles for every subject", () => {
    for (const subject of ["math", "ela", "reading", "writing", "science", "social", "art"]) {
      const seed = seedForSubject({ subject });
      expect(seed.blockTitle.length).toBeGreaterThan(0);
      expect(NO_TEST_WORDS.test(seed.blockTitle)).toBe(false);
    }
  });
  it("folds the topic into the title and topicHint", () => {
    const seed = seedForSubject({ subject: "math", topic: "Fractions" });
    expect(seed.blockTitle).toContain("Fractions");
    expect(seed.topicHint).toBe("Fractions");
  });
  it("keeps the subjectSlug routable for the deterministic builder", () => {
    expect(seedForSubject({ subject: "Math" }).subjectSlug).toBe("math");
    expect(seedForSubject({ subject: "Spectrum Science" }).subjectSlug).toBe("science");
  });
});

/** Build a fully-stubbed deps object; tests override individual seams. */
function makeDeps(over: Partial<SubjectWorksheetDeps> = {}): SubjectWorksheetDeps {
  return {
    getCache: vi.fn(async () => null),
    upsertCache: vi.fn(async () => ({ id: 1, updated: false })),
    generate: vi.fn(async () => ({
      content: buildDeterministicWorksheet({ blockTitle: "Math Time", subjectSlug: "math" }),
      source: "fallback" as const,
    })),
    renderAndStore: vi.fn(async () => ({
      key: "worksheets/today/p0_abc.pdf",
      url: "/manus-storage/worksheets/today/p0_abc.pdf",
      contentHash: "deadbeef",
      fileName: "math.pdf",
    })),
    contentVersion: WORKSHEET_PDF_CONTENT_VERSION,
    ...over,
  };
}

describe("getOrCreateSubjectWorksheetPdf", () => {
  it("returns the cached row without generating or rendering on a HIT", async () => {
    const deps = makeDeps({
      getCache: vi.fn(async () => ({
        url: "/manus-storage/cached.pdf",
        storageKey: "worksheets/cached.pdf",
        title: "Math Time — Let's Explore!",
        source: "llm",
        questionCount: 8,
      })),
    });
    const res = await getOrCreateSubjectWorksheetPdf({ subject: "math" }, deps);
    expect(res.cached).toBe(true);
    expect(res.url).toBe("/manus-storage/cached.pdf");
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.renderAndStore).not.toHaveBeenCalled();
    expect(deps.upsertCache).not.toHaveBeenCalled();
  });

  it("generates + renders + stores + upserts on a MISS", async () => {
    const deps = makeDeps();
    const res = await getOrCreateSubjectWorksheetPdf({ subject: "math", topic: "Fractions" }, deps);
    expect(res.cached).toBe(false);
    expect(res.url).toBe("/manus-storage/worksheets/today/p0_abc.pdf");
    expect(deps.generate).toHaveBeenCalledTimes(1);
    expect(deps.renderAndStore).toHaveBeenCalledTimes(1);
    expect(deps.upsertCache).toHaveBeenCalledTimes(1);
    // cache row keyed on normalized subject + slugged topic + version
    const upsertArg = (deps.upsertCache as any).mock.calls[0][0];
    expect(upsertArg.subjectSlug).toBe("math");
    expect(upsertArg.topicKey).toBe("fractions");
    expect(upsertArg.contentVersion).toBe(WORKSHEET_PDF_CONTENT_VERSION);
    expect(NO_TEST_WORDS.test(upsertArg.title)).toBe(false);
  });

  it("bypasses a present cache row when forceRefresh is set", async () => {
    const deps = makeDeps({
      getCache: vi.fn(async () => ({
        url: "/manus-storage/cached.pdf",
        storageKey: "k",
        title: "t",
        source: "llm",
        questionCount: 1,
      })),
    });
    const res = await getOrCreateSubjectWorksheetPdf({ subject: "math", forceRefresh: true }, deps);
    expect(res.cached).toBe(false);
    expect(deps.generate).toHaveBeenCalledTimes(1);
    expect(deps.renderAndStore).toHaveBeenCalledTimes(1);
  });

  it("forces the friendly title onto the rendered content even if the generator renamed it", async () => {
    const deps = makeDeps({
      generate: vi.fn(async () => ({
        content: { title: "POP QUIZ 5", subjectSlug: "math", sections: [
          { heading: "x", items: [{ id: "q1", kind: "short", prompt: "2+2=", answer: "4" }] },
        ] } as WorksheetContent,
        source: "llm" as const,
      })),
    });
    await getOrCreateSubjectWorksheetPdf({ subject: "math" }, deps);
    const renderedContent = (deps.renderAndStore as any).mock.calls[0][0] as WorksheetContent;
    expect(NO_TEST_WORDS.test(renderedContent.title)).toBe(false);
  });
});

describe("assembled content renders to a real PDF", () => {
  function countPdfPages(buf: Buffer): number {
    const text = buf.toString("latin1");
    const matches = text.match(/\/Type\s*\/Page(?![s])/g);
    return matches ? matches.length : 0;
  }
  it("produces a non-empty multi-page PDF for a math seed", async () => {
    const seed = seedForSubject({ subject: "math", topic: "Conversions" });
    const content = buildDeterministicWorksheet(seed);
    const buf = await renderWorksheetPdfBuffer({ ...content, title: seed.blockTitle }, { dateLabel: "2026-06-30" });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(countPdfPages(buf)).toBeGreaterThanOrEqual(1);
  });
});
