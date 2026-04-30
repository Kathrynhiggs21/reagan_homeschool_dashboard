import { describe, it, expect } from "vitest";
import { derivePracticeLinks, PRACTICE_HOME } from "../shared/practiceLinks";

describe("practiceLinks helper", () => {
  it("uses explicit URLs when both provided", () => {
    const out = derivePracticeLinks({
      subject: "Math",
      title: "Add fractions",
      standardRef: "5.NF.A.1",
      khanUrl: "https://example.com/k",
      ixlUrl: "https://example.com/i",
    });
    expect(out.khan).toBe("https://example.com/k");
    expect(out.ixl).toBe("https://example.com/i");
    expect(out.source).toBe("explicit");
  });

  it("derives Khan/IXL search URLs when no explicit links given", () => {
    const out = derivePracticeLinks({
      subject: "Math",
      title: "Place value to the millions",
      standardRef: "5.NBT.A.1",
    });
    expect(out.khan).toContain("khanacademy.org");
    expect(out.khan).toContain("5.NBT.A.1");
    expect(out.ixl).toContain("ixl.com");
    expect(out.ixl).toContain("Place%20value");
    expect(out.source).toBe("derived");
  });

  it("falls back to title-only when standardRef missing", () => {
    const out = derivePracticeLinks({
      subject: "ELA",
      title: "Cite quote from text",
      standardRef: null,
    });
    expect(out.khan).toContain("Cite%20quote");
    expect(out.ixl).toContain("Cite%20quote");
  });

  it("PRACTICE_HOME exposes 5th-grade landing pages", () => {
    expect(PRACTICE_HOME.khan).toContain("fifth-grade");
    expect(PRACTICE_HOME.ixl).toContain("grade-5");
  });
});
