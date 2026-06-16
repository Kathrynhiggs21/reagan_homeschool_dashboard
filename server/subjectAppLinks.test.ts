import { describe, it, expect } from "vitest";
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
