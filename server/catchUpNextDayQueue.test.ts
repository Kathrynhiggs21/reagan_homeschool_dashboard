/**
 * Push 69 (2026-05-13) — Slice 5 catch-up engine: next-day nudges queue.
 *
 * Distinct from Push 45's catchUpEngine.test.ts which covers the
 * traffic-light + getCatchUpRollup. This test pins the
 * `catchUpQueueFor` helper that turns yesterday's missed topics into
 * a deterministic, capped, subject-rotated queue for Today.
 */
import { describe, it, expect } from "vitest";
import { catchUpQueueFor, type MissedTopic } from "./_lib/catchUpEngine";

const sample: MissedTopic[] = [
  { subjectSlug: "math", topic: "long division", missedOn: "2026-05-12" },
  { subjectSlug: "math", topic: "fractions", missedOn: "2026-05-12" },
  { subjectSlug: "ela", topic: "Tuck Everlasting ch.4", missedOn: "2026-05-12" },
  { subjectSlug: "science", topic: "water cycle", missedOn: "2026-05-12" },
  { subjectSlug: "ela", topic: "180 Days pg.71", missedOn: "2026-05-11" },
];

describe("catchUpQueueFor — next-day nudges", () => {
  it("returns empty queue when cap is 0", () => {
    expect(catchUpQueueFor({ missed: sample, maxQueueSize: 0 })).toEqual([]);
  });

  it("defaults cap to 3", () => {
    const q = catchUpQueueFor({ missed: sample });
    expect(q.length).toBe(3);
  });

  it("clamps cap to 10", () => {
    const q = catchUpQueueFor({ missed: sample, maxQueueSize: 99 });
    expect(q.length).toBeLessThanOrEqual(10);
    expect(q.length).toBeLessThanOrEqual(sample.length);
  });

  it("never repeats subject back-to-back when an alternative exists", () => {
    const q = catchUpQueueFor({ missed: sample, maxQueueSize: 4, seed: "rot" });
    // Walk pairs and verify the algorithm never put the same subject
    // adjacent unless the rotation pool ran out of alternatives.
    for (let i = 1; i < q.length; i++) {
      expect(q[i].subjectSlug).not.toBe(q[i - 1].subjectSlug);
    }
  });

  it("dedupes by subjectSlug::topic", () => {
    const dup = [...sample, sample[0]];
    const q = catchUpQueueFor({ missed: dup, maxQueueSize: 10 });
    const keys = q.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("filters out topics already done today", () => {
    const q = catchUpQueueFor({
      missed: sample,
      alreadyDoneTodayKeys: ["math::long division"],
      maxQueueSize: 5,
      seed: "filter",
    });
    expect(q.find((i) => i.key === "math::long division")).toBeUndefined();
  });

  it("is deterministic for the same seed", () => {
    const a = catchUpQueueFor({ missed: sample, seed: "stable" });
    const b = catchUpQueueFor({ missed: sample, seed: "stable" });
    expect(a.map((i) => i.key)).toEqual(b.map((i) => i.key));
  });

  it("returns empty queue when there are no missed topics", () => {
    expect(catchUpQueueFor({ missed: [] })).toEqual([]);
  });

  it("queue items carry missedOn for the Today-card 'from yesterday' badge", () => {
    const q = catchUpQueueFor({ missed: sample, maxQueueSize: 1 });
    expect(q[0].missedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
