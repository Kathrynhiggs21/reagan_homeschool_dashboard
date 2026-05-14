/**
 * Push 123 (2026-05-13) — Curriculum-coverage strip contract.
 *
 * Pins the coverage % helper that powers Analytics → "this week"
 * strip and the Sunday digest's coverage paragraph. Same bands in
 * both surfaces so they never disagree.
 */
import { describe, it, expect } from "vitest";
import {
  buildCurriculumCoverageStrip,
  CANONICAL_SUBJECTS,
} from "./_lib/curriculumCoverageStrip";

const NOW = 1_780_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function topic(id: string, subject: string, blockType?: string) {
  return { id, subject, blockType };
}

function row(
  topicId: string,
  daysAgo: number,
  status: string,
  minutes = 30,
) {
  return { topicId, loggedAtMs: NOW - daysAgo * DAY, status, minutes };
}

describe("Push 123 — buildCurriculumCoverageStrip", () => {
  it("returns all 5 canonical subjects in fixed order", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [],
      rows: [],
      nowMs: NOW,
    });
    expect(out.perSubject.map((s) => s.subject)).toEqual([
      ...CANONICAL_SUBJECTS,
    ]);
  });

  it("empty plan ⇒ band 'no-plan' per subject and 0% overall", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [],
      rows: [row("t1", 0, "completed", 30)],
      nowMs: NOW,
    });
    for (const s of out.perSubject) {
      expect(s.band).toBe("no-plan");
      expect(s.coveredPct).toBe(0);
    }
    expect(out.overallPct).toBe(0);
    expect(out.overallBand).toBe("no-plan");
  });

  it("morning_vibe topics are silently dropped from the plan", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [
        topic("v1", "math", "morning_vibe"),
        topic("v2", "ela", "morning_warmup"),
        topic("m1", "math"),
      ],
      rows: [row("v1", 0, "completed"), row("m1", 0, "completed")],
      nowMs: NOW,
    });
    const math = out.perSubject.find((s) => s.subject === "math")!;
    expect(math.plannedCount).toBe(1);
    expect(math.coveredCount).toBe(1);
    expect(math.coveredPct).toBe(100);
    const ela = out.perSubject.find((s) => s.subject === "ela")!;
    expect(ela.plannedCount).toBe(0); // morning_warmup ignored
    expect(ela.band).toBe("no-plan");
  });

  it("only completed/in-progress rows with minutes>0 cover a topic", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [topic("m1", "math"), topic("m2", "math"), topic("m3", "math")],
      rows: [
        row("m1", 0, "completed", 30),
        row("m2", 0, "missed", 0),
        row("m3", 0, "completed", 0), // 0 minutes ⇒ doesn't count
      ],
      nowMs: NOW,
    });
    const math = out.perSubject.find((s) => s.subject === "math")!;
    expect(math.plannedCount).toBe(3);
    expect(math.coveredCount).toBe(1);
    expect(math.coveredPct).toBe(33);
  });

  it("rows outside the 7-day window are dropped", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [topic("m1", "math")],
      rows: [row("m1", 8, "completed", 30)],
      nowMs: NOW,
    });
    const math = out.perSubject.find((s) => s.subject === "math")!;
    expect(math.coveredCount).toBe(0);
    expect(math.coveredPct).toBe(0);
  });

  it("dedupes covered topics so two completions of the same topic don't inflate coverage", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [topic("m1", "math"), topic("m2", "math")],
      rows: [
        row("m1", 0, "completed", 30),
        row("m1", 1, "completed", 30),
        row("m1", 2, "in-progress", 5),
      ],
      nowMs: NOW,
    });
    const math = out.perSubject.find((s) => s.subject === "math")!;
    expect(math.coveredCount).toBe(1);
    expect(math.coveredPct).toBe(50);
  });

  it("unplanned rows are ignored", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [topic("m1", "math")],
      rows: [row("ghost", 0, "completed", 30), row("m1", 0, "completed", 30)],
      nowMs: NOW,
    });
    const math = out.perSubject.find((s) => s.subject === "math")!;
    expect(math.coveredCount).toBe(1);
  });

  it("bands: 0–24% red, 25–59% amber, 60–84% on-track, 85–100% strong", () => {
    function pctFor(planned: number, covered: number) {
      const planArr = Array.from({ length: planned }, (_, i) =>
        topic(`m${i}`, "math"),
      );
      const rowArr = Array.from({ length: covered }, (_, i) =>
        row(`m${i}`, 0, "completed"),
      );
      const out = buildCurriculumCoverageStrip({
        planned: planArr,
        rows: rowArr,
        nowMs: NOW,
      });
      return out.perSubject.find((s) => s.subject === "math")!.band;
    }
    expect(pctFor(10, 0)).toBe("red");
    expect(pctFor(10, 2)).toBe("red"); // 20%
    expect(pctFor(10, 3)).toBe("amber"); // 30%
    expect(pctFor(10, 6)).toBe("on-track"); // 60%
    expect(pctFor(10, 9)).toBe("strong"); // 90%
    expect(pctFor(10, 10)).toBe("strong"); // 100%
  });

  it("overallPct is planned-weighted, not subject-averaged", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [
        topic("m1", "math"),
        topic("m2", "math"),
        topic("m3", "math"),
        topic("m4", "math"),
        topic("e1", "ela"),
      ],
      rows: [row("m1", 0, "completed"), row("e1", 0, "completed")],
      nowMs: NOW,
    });
    // 2 of 5 planned = 40%, NOT (25% + 100%)/2 = 62.5%
    expect(out.overallPct).toBe(40);
    expect(out.overallBand).toBe("amber");
  });

  it("zeroCoverageSubjects only lists subjects that have a plan but no coverage", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [
        topic("m1", "math"),
        topic("e1", "ela"),
        topic("sci1", "science"),
      ],
      rows: [row("m1", 0, "completed")],
      nowMs: NOW,
    });
    expect(out.zeroCoverageSubjects.sort()).toEqual(["ela", "science"].sort());
  });

  it("malformed planned and row inputs are silently dropped", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [
        topic("m1", "math"),
        topic("", "math"), // empty id
        topic("a1", "art"), // unknown subject
        // @ts-expect-error - malformed
        null,
      ],
      rows: [
        row("m1", 0, "completed"),
        // @ts-expect-error - malformed
        null,
        { topicId: "m1", loggedAtMs: NaN, status: "completed", minutes: 30 },
      ],
      nowMs: NOW,
    });
    const math = out.perSubject.find((s) => s.subject === "math")!;
    expect(math.plannedCount).toBe(1);
    expect(math.coveredCount).toBe(1);
  });

  it("non-finite nowMs collapses window to 0..0 and yields no coverage but still safe shape", () => {
    const out = buildCurriculumCoverageStrip({
      planned: [topic("m1", "math")],
      rows: [row("m1", 0, "completed")],
      nowMs: NaN,
    });
    expect(out.windowStartMs).toBeLessThanOrEqual(out.windowEndMs);
    const math = out.perSubject.find((s) => s.subject === "math")!;
    expect(math.coveredCount).toBe(0);
  });
});
