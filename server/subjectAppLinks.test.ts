import { describe, it, expect, afterEach } from "vitest";
import { subjectAppLink } from "./_lib/subjectAppLinks";

describe("subjectAppLink — lands on a SPECIFIC IXL skill, not a topic list", () => {
  it("measurement conversions -> customary conversion skill", () => {
    const r = subjectAppLink({ subjectSlug: "math", title: "Intro to Measurement Conversions", topicHint: "convert customary units" });
    expect(r.app).toBe("ixl");
    expect(r.url).toMatch(/ixl\.com\/math\/grade-5\/.+/);
    expect(r.url).not.toMatch(/grade-5$/); // not the bare topic list
  });

  it("metric units -> metric conversion skill", () => {
    const r = subjectAppLink({ subjectSlug: "math", title: "Metric Units Intro", topicHint: "metric ladder mm cm m km" });
    expect(r.url).toContain("compare-and-convert-metric-units");
  });

  it("volume with unit cubes -> unit-cubes volume skill", () => {
    const r = subjectAppLink({ subjectSlug: "math", title: "Volume Intro", topicHint: "filling space with unit cubes" });
    expect(r.url).toContain("volume-of-rectangular-prisms-made-of-unit-cubes");
  });

  it("plain volume -> rectangular prisms volume skill", () => {
    const r = subjectAppLink({ subjectSlug: "math", title: "Volume of a box", topicHint: "length width height" });
    expect(r.url).toContain("volume-of-rectangular-prisms");
  });

  it("math always offers Prodigy + Khan + Education as alts", () => {
    const r = subjectAppLink({ subjectSlug: "math", title: "Fractions practice" });
    const apps = (r.alts ?? []).map((a) => a.app);
    expect(apps).toContain("prodigy");
    expect(apps).toContain("khan");
    expect(apps).toContain("education");
  });

  it("ELA/writing -> IXL ela grade-5", () => {
    const r = subjectAppLink({ subjectSlug: "ela", title: "Poetry Intro -> Haiku", topicHint: "write a haiku" });
    expect(r.url).toContain("ixl.com/ela/grade-5");
    const apps = (r.alts ?? []).map((a) => a.app);
    expect(apps).not.toContain("prodigy"); // prodigy only on math
  });

  it("science measurement -> units-and-measurement area", () => {
    const r = subjectAppLink({ subjectSlug: "science", title: "Measuring mass", topicHint: "metric units of mass" });
    expect(r.url).toContain("science/units-and-measurement");
  });

  it("social studies -> IXL social-studies grade-5", () => {
    const r = subjectAppLink({ subjectSlug: "social-studies", title: "Early US History" });
    expect(r.url).toContain("social-studies/grade-5");
  });
});

describe("subjectAppLink — optional IXL QuickStart no-password launcher", () => {
  const ORIG = process.env.IXL_QUICKSTART_URL;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.IXL_QUICKSTART_URL;
    else process.env.IXL_QUICKSTART_URL = ORIG;
  });

  it("falls back to the specific skill deep link when no QuickStart URL is set", () => {
    delete process.env.IXL_QUICKSTART_URL;
    const r = subjectAppLink({ subjectSlug: "math", title: "Metric Units Intro", topicHint: "metric" });
    expect(r.label).toBe("Open in IXL");
    expect(r.url).toContain("compare-and-convert-metric-units");
  });

  it("substitutes {skill} placeholder when present", () => {
    process.env.IXL_QUICKSTART_URL = "https://www.ixl.com/signin/quickstart?code=ABC123&go={skill}";
    const r = subjectAppLink({ subjectSlug: "math", title: "Metric Units Intro", topicHint: "metric" });
    expect(r.label).toBe("Open in IXL (no sign-in)");
    expect(r.url).toContain("quickstart?code=ABC123");
    expect(r.url).toContain(encodeURIComponent("https://www.ixl.com/math/grade-5/compare-and-convert-metric-units"));
  });

  it("appends ?destination= when launcher has no existing query string", () => {
    process.env.IXL_QUICKSTART_URL = "https://www.ixl.com/signin/quickstart/ABC123";
    const r = subjectAppLink({ subjectSlug: "ela", title: "Reading comprehension" });
    expect(r.url).toContain("?destination=");
    expect(r.url).toContain(encodeURIComponent("https://www.ixl.com/ela/grade-5"));
  });

  it("uses launcher as-is when it already has a query string and no placeholder", () => {
    process.env.IXL_QUICKSTART_URL = "https://www.ixl.com/signin/quickstart?code=ABC123";
    const r = subjectAppLink({ subjectSlug: "science", title: "Water cycle" });
    expect(r.url).toBe("https://www.ixl.com/signin/quickstart?code=ABC123");
  });

  it("ignores a blank/whitespace QuickStart URL", () => {
    process.env.IXL_QUICKSTART_URL = "   ";
    const r = subjectAppLink({ subjectSlug: "math", title: "Fractions" });
    expect(r.label).toBe("Open in IXL");
    expect(r.url).toContain("ixl.com/math/grade-5/");
  });

  it("ignores a bare homepage / marketing URL (e.g. ?customDomain=quickstart) and deep-links to the skill", () => {
    // Real-world value Katy had: a homepage URL with no sign-in PATH. It is NOT
    // a no-password launcher, so we must fall back to the exact skill deep link.
    process.env.IXL_QUICKSTART_URL = "https://www.ixl.com/?customDomain=quickstart";
    const r = subjectAppLink({ subjectSlug: "math", title: "Metric Units Intro", topicHint: "metric" });
    expect(r.label).toBe("Open in IXL");
    expect(r.url).toContain("compare-and-convert-metric-units");
    expect(r.url).not.toContain("customDomain");
  });

  it("ignores any other site-root URL with a query but no sign-in path", () => {
    process.env.IXL_QUICKSTART_URL = "https://www.ixl.com/?foo=bar";
    const r = subjectAppLink({ subjectSlug: "ela", title: "Reading" });
    expect(r.label).toBe("Open in IXL");
    expect(r.url).toContain("ixl.com/ela/grade-5");
  });
});
