import { describe, it, expect } from "vitest";
import { subjectAppLink } from "./_lib/subjectAppLinks";
import { listAllowedHosts } from "./_lib/kidSafeAllowlist";

/**
 * 2026-06-18 — Guards the link fixes from the app-link audit:
 *  - Education.com must use the current /resources/grade-5/* taxonomy
 *    (the legacy /resources/fifth-grade/* slug 404s / relies on fragile redirects).
 *  - The dead Wonderopolis domain (NCFL closed the site 2025-07-31) must not
 *    reappear in the kid-safe allowlist.
 *  - IXL ELA/science/social links use the verified grade-5 path form, never the
 *    literal "ela|science|social-studies" pipe placeholder from the docstring.
 */

function allEducationUrls(): string[] {
  const buckets = [
    { subjectSlug: "math", title: "fractions", topicHint: "" },
    { subjectSlug: "science", title: "matter", topicHint: "" },
    { subjectSlug: "ela", title: "grammar", topicHint: "" },
    { subjectSlug: "reading", title: "novel", topicHint: "" },
    { subjectSlug: "writing", title: "essay", topicHint: "" },
    { subjectSlug: "social-studies", title: "geography", topicHint: "" },
    { subjectSlug: "", title: "", topicHint: "" },
  ];
  const urls: string[] = [];
  for (const b of buckets) {
    const t = subjectAppLink(b);
    for (const alt of t.alts ?? []) {
      if (alt.app === "education") urls.push(alt.url);
    }
  }
  return urls;
}

describe("education.com app links use current taxonomy", () => {
  it("never emits the legacy /fifth-grade/ slug", () => {
    for (const url of allEducationUrls()) {
      expect(url).not.toContain("/fifth-grade/");
      expect(url).toContain("/resources/grade-5/");
    }
  });

  it("routes ELA to the english-language-arts slug, not reading-writing", () => {
    const ela = subjectAppLink({ subjectSlug: "ela", title: "grammar", topicHint: "" });
    const edu = (ela.alts ?? []).find((a) => a.app === "education");
    expect(edu?.url).toBe("https://www.education.com/resources/grade-5/english-language-arts/");
    expect(edu?.url).not.toContain("reading-writing");
  });
});

describe("IXL links use verified path form", () => {
  it("never emits the literal pipe placeholder", () => {
    const subjects = ["math", "science", "ela", "reading", "writing", "social-studies"];
    for (const s of subjects) {
      const t = subjectAppLink({ subjectSlug: s, title: "topic", topicHint: "" });
      const allUrls = [t.url, ...(t.alts ?? []).map((a) => a.url)];
      for (const u of allUrls) {
        expect(u).not.toContain("ela|science|social-studies");
      }
    }
  });
});

describe("kid-safe allowlist", () => {
  it("does not include the permanently-closed wonderopolis.org", () => {
    expect(listAllowedHosts(false)).not.toContain("wonderopolis.org");
    expect(listAllowedHosts(true)).not.toContain("wonderopolis.org");
  });
});
