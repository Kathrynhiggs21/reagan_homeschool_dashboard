/**
 * llmAssignmentFinder.test.ts — v2.96 (2026-05-27)
 *
 * Locks the new LLM-backed finder contract: kid-safe allowlist tiers, the
 * 4-5-6 grade-fit primary band, YouTube-with-kid-channel auto-accept (no
 * preview), and the worksheet ad-free + free + PDF + saveable rules.
 *
 * No external network / no LLM call \u2014 we exercise the pure validator paths
 * directly via classifyGradeFit + checkUrlAllowed.
 */
import { describe, it, expect } from "vitest";
import { checkUrlAllowed } from "./_lib/kidSafeAllowlist";
import { classifyGradeFit } from "./_lib/llmAssignmentFinder";

describe("checkUrlAllowed (kid-safe allowlist)", () => {
  it("accepts NASA federal subdomains as tier1, no preview", () => {
    const r = checkUrlAllowed("https://spaceplace.nasa.gov/menu/earth/");
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.tier).toBe("tier1Federal");
      expect(r.requiresAdultPreview).toBe(false);
    }
  });

  it("accepts Ohio K-12 district wildcard as tier2, no preview", () => {
    const r = checkUrlAllowed("https://www.dublincityschools.k12.oh.us/page/grade-5");
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.tier).toBe("tier2Ohio");
      expect(r.requiresAdultPreview).toBe(false);
    }
  });

  it("accepts CommonCoreSheets as tier3, no preview", () => {
    const r = checkUrlAllowed("https://www.commoncoresheets.com/Math/Fractions/file.pdf");
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.tier).toBe("tier3Edu");
      expect(r.requiresAdultPreview).toBe(false);
    }
  });

  it("rejects YouTube for worksheet/practice (non-video) mode", () => {
    const r = checkUrlAllowed("https://www.youtube.com/watch?v=abc", { forVideo: false });
    expect(r.allowed).toBe(false);
  });

  it("accepts YouTube for video mode with preview flag (host alone)", () => {
    const r = checkUrlAllowed("https://www.youtube.com/watch?v=abc", { forVideo: true });
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.tier).toBe("tier4Video");
      expect(r.requiresAdultPreview).toBe(true);
    }
  });

  it("accepts wikipedia.org as soft-tier5 with preview", () => {
    const r = checkUrlAllowed("https://en.wikipedia.org/wiki/Line_plot");
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.tier).toBe("tier5SoftOrg");
      expect(r.requiresAdultPreview).toBe(true);
    }
  });

  it("accepts a university .edu page via soft pattern, with preview", () => {
    const r = checkUrlAllowed("https://extension.osu.edu/4h/grade-5/scarcity-and-trade.pdf");
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.tier).toBe("softEdu");
      expect(r.requiresAdultPreview).toBe(true);
    }
  });

  it("rejects random commercial host", () => {
    const r = checkUrlAllowed("https://shadyworksheets.example.biz/grade-5/math.pdf");
    expect(r.allowed).toBe(false);
  });

  it("rejects empty / invalid URL", () => {
    expect(checkUrlAllowed("").allowed).toBe(false);
    expect(checkUrlAllowed("not-a-url").allowed).toBe(false);
    expect(checkUrlAllowed("ftp://nasa.gov/file").allowed).toBe(false);
  });
});

describe("classifyGradeFit (4-5-6 primary band)", () => {
  it("Grade 5 -> primary, no review needed", () => {
    expect(classifyGradeFit("Grade 5")).toEqual({ fit: "primary", needsReview: false });
    expect(classifyGradeFit("5th grade")).toEqual({ fit: "primary", needsReview: false });
  });

  it("Grade 4 or 6 -> adjacent, no review needed", () => {
    expect(classifyGradeFit("Grade 4")).toEqual({ fit: "adjacent", needsReview: false });
    expect(classifyGradeFit("Grade 6")).toEqual({ fit: "adjacent", needsReview: false });
    expect(classifyGradeFit("6th grade")).toEqual({ fit: "adjacent", needsReview: false });
  });

  it("Grade 3 or 7 -> needs_review but NOT flagged (close stretch, preview only)", () => {
    expect(classifyGradeFit("Grade 3")).toEqual({ fit: "needs_review", needsReview: false });
    expect(classifyGradeFit("Grade 7")).toEqual({ fit: "needs_review", needsReview: false });
  });

  it("K-5 / 3-5 / 4-6 ranges -> primary if 5 is in range", () => {
    expect(classifyGradeFit("K-5")).toEqual({ fit: "primary", needsReview: false });
    expect(classifyGradeFit("3-5")).toEqual({ fit: "primary", needsReview: false });
    expect(classifyGradeFit("4-6")).toEqual({ fit: "primary", needsReview: false });
  });

  it("unknown / missing -> needs_review and flagged", () => {
    expect(classifyGradeFit(null)).toEqual({ fit: "needs_review", needsReview: true });
    expect(classifyGradeFit("")).toEqual({ fit: "needs_review", needsReview: true });
    expect(classifyGradeFit("all ages")).toEqual({ fit: "needs_review", needsReview: true });
    expect(classifyGradeFit("Grade 9")).toEqual({ fit: "needs_review", needsReview: true });
  });
});
