import { describe, it, expect } from "vitest";
import {
  WARNING_ZONES,
  CRISIS_PROTOCOL,
  getWarningZone,
  anxietyContributionFromZones,
  type WarningZone,
} from "./_lib/warningZones";
import {
  WHAT_WORKS_MATRIX,
  getWhatWorksRow,
  whatWorksPromptAddendum,
} from "./_lib/whatWorks";

describe("warningZones — codified from canonical IEP doc", () => {
  it("exports exactly the 4 canonical zones", () => {
    expect(WARNING_ZONES.map(z => z.zone)).toEqual(["green", "yellow", "red", "black"]);
  });

  it("every zone has at least 5 observable signals (quality bar)", () => {
    for (const z of WARNING_ZONES) {
      expect(z.observableSignals.length, `${z.zone} should have >= 5 signals`).toBeGreaterThanOrEqual(5);
    }
  });

  it("every zone has response actions AND avoid actions", () => {
    for (const z of WARNING_ZONES) {
      expect(z.response.length, `${z.zone} response`).toBeGreaterThan(0);
      expect(z.avoid.length, `${z.zone} avoid`).toBeGreaterThan(0);
    }
  });

  it("anxietyScoreWeight is monotonic across zones (green=0 < yellow < red < black)", () => {
    const w = WARNING_ZONES.map(z => z.anxietyScoreWeight);
    expect(w[0]).toBe(0);
    expect(w[1]).toBeLessThan(w[2]);
    expect(w[2]).toBeLessThan(w[3]);
  });

  it("getWarningZone throws on unknown zone (loud failure)", () => {
    expect(() => getWarningZone("blue" as WarningZone)).toThrow();
  });

  it("anxietyContributionFromZones caps at 100 even with many red observations", () => {
    const many: WarningZone[] = Array(20).fill("red");
    expect(anxietyContributionFromZones(many)).toBe(100);
  });

  it("anxietyContributionFromZones gives 0 for all-green day", () => {
    expect(anxietyContributionFromZones(["green", "green", "green"])).toBe(0);
  });

  it("Yellow + Red day produces a meaningful intermediate score", () => {
    // 1 yellow (15) + 1 red (30) = 45
    expect(anxietyContributionFromZones(["yellow", "red"])).toBe(45);
  });
});

describe("CRISIS_PROTOCOL — 3-step decision tree", () => {
  it("has exactly 3 steps in order", () => {
    expect(CRISIS_PROTOCOL.map(s => s.step)).toEqual([1, 2, 3]);
  });

  it("step windows are increasing (0-30 → 30-60 → 60-120)", () => {
    expect(CRISIS_PROTOCOL[0].windowSeconds.max).toBeLessThanOrEqual(CRISIS_PROTOCOL[1].windowSeconds.min);
    expect(CRISIS_PROTOCOL[1].windowSeconds.max).toBeLessThanOrEqual(CRISIS_PROTOCOL[2].windowSeconds.min);
  });

  it("step 3 contact list includes Mom's number", () => {
    const step3 = CRISIS_PROTOCOL[2];
    const joined = step3.actions.join(" | ");
    expect(joined).toContain("513-926-5808");
  });
});

describe("whatWorks — matrix + AI agenda addendum", () => {
  it("covers all 6 canonical situations", () => {
    expect(WHAT_WORKS_MATRIX.map(r => r.situation).sort()).toEqual(
      ["anxiety_rising", "during_crisis", "mistakes_made", "morning_arrival", "testing", "writing_tasks"],
    );
  });

  it("every row has at least 1 doesNotWork AND 1 doesWork item", () => {
    for (const r of WHAT_WORKS_MATRIX) {
      expect(r.doesNotWork.length, `${r.situation} doesNotWork`).toBeGreaterThan(0);
      expect(r.doesWork.length, `${r.situation} doesWork`).toBeGreaterThan(0);
    }
  });

  it("getWhatWorksRow returns the row by situation key", () => {
    const r = getWhatWorksRow("writing_tasks");
    expect(r.label).toBe("Writing Tasks");
    expect(r.doesWork).toContain("Verbal first");
  });

  it("whatWorksPromptAddendum produces a prompt-ready text block with all situations", () => {
    const text = whatWorksPromptAddendum();
    expect(text).toContain("REAGAN-SPECIFIC GUIDANCE");
    for (const r of WHAT_WORKS_MATRIX) {
      expect(text).toContain(r.label);
      expect(text).toContain("AVOID:");
      expect(text).toContain("DO:");
    }
  });
});
