import { describe, expect, it } from "vitest";
import { getCoverageDelta, type CoverageDeltaActualEntry, type CoverageDeltaPlannedBlock } from "./db";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Pure-function tests for getCoverageDelta — Slice 4.5 foundation.
 * Also asserts the route + helpers are wired together at the source level
 * (no DB needed; just contract assertions).
 */
describe("Slice 4.5 — getCoverageDelta", () => {
  const planned: CoverageDeltaPlannedBlock[] = [
    { blockId: 1, subjectSlug: "math", title: "Fractions intro", status: "complete", curriculumTopicId: 100 },
    { blockId: 2, subjectSlug: "ela", title: "Reading: chapter 4", status: "complete", curriculumTopicId: 200 },
    { blockId: 3, subjectSlug: "science", title: "Animal habitats", status: "not_started", curriculumTopicId: null },
  ];

  it("matches by exact plannedBlockId reference", () => {
    const actual: CoverageDeltaActualEntry[] = [
      { entryId: 10, subjectSlug: "math", topic: "anything else", minutesSpent: 30, source: "mom-input", plannedBlockId: 1 },
    ];
    const d = getCoverageDelta(planned, actual);
    expect(d.matched).toEqual([{ blockId: 1, entryIds: [10] }]);
    expect(d.unmatchedPlanned.map((p) => p.blockId)).toEqual([2, 3]);
    expect(d.unmatchedActual).toHaveLength(0);
    expect(d.coveragePercent).toBe(33);
  });

  it("matches by subject + substring topic overlap when no plannedBlockId", () => {
    const actual: CoverageDeltaActualEntry[] = [
      { entryId: 11, subjectSlug: "ela", topic: "chapter 4", minutesSpent: 25, source: "grandma-recap", plannedBlockId: null },
    ];
    const d = getCoverageDelta(planned, actual);
    expect(d.matched).toEqual([{ blockId: 2, entryIds: [11] }]);
    expect(d.unmatchedActual).toHaveLength(0);
  });

  it("flags off-plan actual entries when no planned block matches", () => {
    const actual: CoverageDeltaActualEntry[] = [
      { entryId: 12, subjectSlug: "art", topic: "Painted self-portraits", minutesSpent: 45, source: "grandma-recap", plannedBlockId: null },
    ];
    const d = getCoverageDelta(planned, actual);
    expect(d.matched).toHaveLength(0);
    expect(d.unmatchedPlanned).toHaveLength(3);
    expect(d.unmatchedActual.map((a) => a.entryId)).toEqual([12]);
    expect(d.coveragePercent).toBe(0);
  });

  it("computes 100% coverage when every planned block has an actual entry", () => {
    const actual: CoverageDeltaActualEntry[] = [
      { entryId: 20, subjectSlug: "math", topic: "x", minutesSpent: 1, source: "mom-input", plannedBlockId: 1 },
      { entryId: 21, subjectSlug: "ela", topic: "y", minutesSpent: 1, source: "mom-input", plannedBlockId: 2 },
      { entryId: 22, subjectSlug: "science", topic: "z", minutesSpent: 1, source: "mom-input", plannedBlockId: 3 },
    ];
    const d = getCoverageDelta(planned, actual);
    expect(d.coveragePercent).toBe(100);
    expect(d.unmatchedPlanned).toHaveLength(0);
    expect(d.unmatchedActual).toHaveLength(0);
  });

  it("returns 0% coverage when nothing was done", () => {
    const d = getCoverageDelta(planned, []);
    expect(d.coveragePercent).toBe(0);
    expect(d.unmatchedPlanned).toHaveLength(3);
    expect(d.totalActualEntries).toBe(0);
  });
});

describe("Slice 4.5 — wiring assertions", () => {
  const dbSrc = readFileSync(resolve(__dirname, "db.ts"), "utf8");
  const routeSrc = readFileSync(resolve(__dirname, "scheduledSync.ts"), "utf8");

  it("queueOffPlanTopicForDriveSync exists and enqueues into drivePushQueue", () => {
    expect(dbSrc).toMatch(/export async function queueOffPlanTopicForDriveSync/);
    expect(dbSrc).toMatch(/db\.insert\(drivePushQueue\)\.values\(\{[^}]*target: "topics_covered"/s);
  });

  it("markTopicAsCovered stamps last_covered_source + last_covered_at", () => {
    expect(dbSrc).toMatch(/export async function markTopicAsCovered/);
    expect(dbSrc).toMatch(/last_covered_source = \$\{source\}/);
    expect(dbSrc).toMatch(/last_covered_at = \$\{now\}/);
  });

  it("daily-recap-reply route now calls queueOffPlanTopicForDriveSync for off-plan entries", () => {
    expect(routeSrc).toMatch(/queueOffPlanTopicForDriveSync/);
    // and the markdown body it generates includes the date + subject for the Drive file
    expect(routeSrc).toMatch(/# \$\{e\.topic\}/);
    expect(routeSrc).toMatch(/Source:.*\$\{source\}/);
  });
});
