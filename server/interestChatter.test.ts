import { describe, it, expect } from "vitest";
import { pickInterestChatter } from "../shared/interestEngine";

describe("pickInterestChatter", () => {
  it("returns null for empty / nullish labels (never invents an interest)", () => {
    expect(pickInterestChatter(null)).toBeNull();
    expect(pickInterestChatter(undefined)).toBeNull();
    expect(pickInterestChatter("")).toBeNull();
    expect(pickInterestChatter("   ")).toBeNull();
  });

  it("includes the lowercased label in the line", () => {
    const line = pickInterestChatter("Birds", 0);
    expect(line).toBeTruthy();
    expect(line!.toLowerCase()).toContain("birds");
  });

  it("is deterministic for a given seed", () => {
    const a = pickInterestChatter("art", 0.42);
    const b = pickInterestChatter("art", 0.42);
    expect(a).toBe(b);
  });

  it("different seeds can pick different templates but always embed the label", () => {
    const lines = [0, 0.2, 0.4, 0.6, 0.8, 0.99].map((s) => pickInterestChatter("minecraft", s)!);
    for (const l of lines) {
      expect(l.toLowerCase()).toContain("minecraft");
    }
  });

  it("never produces school-pushy phrasing", () => {
    const banned = ["homework", "assignment", "study", "worksheet", "must", "have to"];
    for (const s of [0, 0.25, 0.5, 0.75, 0.95]) {
      const l = pickInterestChatter("animals", s)!.toLowerCase();
      for (const b of banned) expect(l).not.toContain(b);
    }
  });
});
