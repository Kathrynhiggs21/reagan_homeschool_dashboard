/**
 * Push 107 (2026-05-13) — Off-plan topic auto-add gating contract.
 */
import { describe, it, expect } from "vitest";
import {
  CANONICAL_SUBJECTS,
  decideOffPlanTopicAutoAdd,
} from "./_lib/offPlanTopicAutoAdd";

const EMPTY_INDEX = { existingLabels: [] as string[] };

describe("Push 107 — off-plan topic auto-add gating", () => {
  it("manual override always promotes (Mom/Grandma confirmation wins)", () => {
    const r = decideOffPlanTopicAutoAdd(
      {
        topicLabel: "Crystal growth experiment",
        subjectSlug: "science",
        confidence: 0.1,
        manualOverride: true,
      },
      EMPTY_INDEX,
    );
    expect(r.promote).toBe(true);
    if (r.promote) expect(r.reason).toBe("manual-override");
  });

  it("kiwi-confident: confidence ≥ 0.6 promotes", () => {
    const r = decideOffPlanTopicAutoAdd(
      {
        topicLabel: "Phases of the moon",
        subjectSlug: "science",
        confidence: 0.7,
      },
      EMPTY_INDEX,
    );
    expect(r.promote).toBe(true);
    if (r.promote) expect(r.reason).toBe("kiwi-confident");
  });

  it("repeated-capture: low confidence but ≥ 2 recent hits promotes", () => {
    const r = decideOffPlanTopicAutoAdd(
      {
        topicLabel: "Origami fractions",
        subjectSlug: "math",
        confidence: 0.3,
        recentHitCount: 3,
      },
      EMPTY_INDEX,
    );
    expect(r.promote).toBe(true);
    if (r.promote) expect(r.reason).toBe("repeated-capture");
  });

  it("low confidence + single hit does NOT promote", () => {
    const r = decideOffPlanTopicAutoAdd(
      {
        topicLabel: "Random thought",
        subjectSlug: "ela",
        confidence: 0.2,
        recentHitCount: 1,
      },
      EMPTY_INDEX,
    );
    expect(r.promote).toBe(false);
    if (!r.promote) expect(r.reason).toBe("low-confidence-single-hit");
  });

  it("empty label is rejected", () => {
    for (const lbl of ["", "   ", "\t\n"]) {
      const r = decideOffPlanTopicAutoAdd(
        { topicLabel: lbl, subjectSlug: "math", confidence: 1 },
        EMPTY_INDEX,
      );
      expect(r.promote).toBe(false);
      if (!r.promote) expect(r.reason).toBe("empty-label");
    }
  });

  it("non-canonical subject is rejected even with manual override", () => {
    const r = decideOffPlanTopicAutoAdd(
      {
        topicLabel: "Cooking measurements",
        subjectSlug: "lifeskills",
        manualOverride: true,
      },
      EMPTY_INDEX,
    );
    expect(r.promote).toBe(false);
    if (!r.promote) expect(r.reason).toBe("non-canonical-subject");
  });

  it("already-in-curriculum is rejected (case-insensitive)", () => {
    const r = decideOffPlanTopicAutoAdd(
      {
        topicLabel: "Phases of the Moon",
        subjectSlug: "science",
        confidence: 1,
      },
      { existingLabels: ["phases of the moon"] },
    );
    expect(r.promote).toBe(false);
    if (!r.promote) expect(r.reason).toBe("already-in-curriculum");
  });

  it("CANONICAL_SUBJECTS lock matches the 5-subject taxonomy", () => {
    expect([...CANONICAL_SUBJECTS]).toEqual([
      "math",
      "ela",
      "science",
      "social-studies",
      "specials",
    ]);
  });

  it("confidence 0.6 boundary is inclusive (promotes)", () => {
    const r = decideOffPlanTopicAutoAdd(
      {
        topicLabel: "Boundary topic",
        subjectSlug: "math",
        confidence: 0.6,
      },
      EMPTY_INDEX,
    );
    expect(r.promote).toBe(true);
  });

  it("invalid confidence types fall back to 0 (and need repeat hits to promote)", () => {
    const r = decideOffPlanTopicAutoAdd(
      {
        topicLabel: "NaN-confidence topic",
        subjectSlug: "math",
        confidence: NaN as any,
        recentHitCount: 1,
      },
      EMPTY_INDEX,
    );
    expect(r.promote).toBe(false);
  });
});
