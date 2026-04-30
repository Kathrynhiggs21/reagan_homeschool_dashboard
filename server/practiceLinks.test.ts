import { describe, it, expect } from "vitest";
import {
  derivePracticeLinks,
  PRACTICE_HOME,
  IH_IXL_SIGNIN,
  KHAN_KIDS_HOME,
} from "../shared/practiceLinks";

describe("practiceLinks helper", () => {
  it("uses explicit URLs when provided (no prefs)", () => {
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
    expect(out.usedIhSso).toBe(false);
    expect(out.usedKhanKids).toBe(false);
  });

  it("derives Khan + IXL search URLs when no explicit links given", () => {
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

  it("routes IXL through IH SSO when ihIxl pref is on", () => {
    const out = derivePracticeLinks({
      subject: "Math",
      title: "Add fractions",
      standardRef: "5.NF.A.1",
      prefs: { ihIxl: true },
    });
    expect(out.ixl).toContain(IH_IXL_SIGNIN);
    expect(out.ixl).toContain("returnUrl=");
    expect(out.usedIhSso).toBe(true);
  });

  it("wraps explicit IXL URL with IH SSO when pref is on", () => {
    const out = derivePracticeLinks({
      subject: "Math",
      title: "X",
      standardRef: null,
      ixlUrl: "https://www.ixl.com/math/grade-5/add-fractions",
      prefs: { ihIxl: true },
    });
    expect(out.ixl).toContain(IH_IXL_SIGNIN);
    expect(out.ixl).toContain(
      encodeURIComponent("https://www.ixl.com/math/grade-5/add-fractions"),
    );
  });

  it("uses Khan Kids domain when khanKids pref AND topic is scaffolded", () => {
    const out = derivePracticeLinks({
      subject: "Math",
      title: "Counting to 100",
      standardRef: null,
      scaffolded: true,
      prefs: { khanKids: true },
    });
    expect(out.khan).toContain(KHAN_KIDS_HOME);
    expect(out.usedKhanKids).toBe(true);
  });

  it("does NOT use Khan Kids when topic is not flagged scaffolded", () => {
    const out = derivePracticeLinks({
      subject: "Math",
      title: "Fluency drill",
      standardRef: null,
      prefs: { khanKids: true },
    });
    expect(out.khan).toContain("khanacademy.org");
    expect(out.khan).not.toContain("khanacademykids");
    expect(out.usedKhanKids).toBe(false);
  });

  it("both prefs can stack", () => {
    const out = derivePracticeLinks({
      subject: "ELA",
      title: "Sound out CVC words",
      standardRef: null,
      scaffolded: true,
      prefs: { ihIxl: true, khanKids: true },
    });
    expect(out.khan).toContain(KHAN_KIDS_HOME);
    expect(out.ixl).toContain(IH_IXL_SIGNIN);
  });

  it("PRACTICE_HOME exposes 5th-grade + IH SSO + Khan Kids landing pages", () => {
    expect(PRACTICE_HOME.khan).toContain("fifth-grade");
    expect(PRACTICE_HOME.ixl).toContain("grade-5");
    expect(PRACTICE_HOME.ixlIhSso).toBe(IH_IXL_SIGNIN);
    expect(PRACTICE_HOME.khanKids).toBe(KHAN_KIDS_HOME);
  });
});
