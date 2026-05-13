/**
 * Push 32 (2026-05-13) — Backfill helper contract.
 *
 * Verifies the backfill helper can match on title, handle ambiguity,
 * report unmatched, and remain idempotent in dryRun.
 */
import { describe, it, expect } from "vitest";
import { backfillScheduleBlockTopics } from "./_lib/backfillScheduleBlockTopics";

describe("backfillScheduleBlockTopics — push 32", () => {
  it("returns a structured BackfillReport", async () => {
    const report = await backfillScheduleBlockTopics({ dryRun: true });
    expect(report).toBeDefined();
    expect(typeof report.scanned).toBe("number");
    expect(typeof report.exactMatches).toBe("number");
    expect(typeof report.substringMatches).toBe("number");
    expect(typeof report.ambiguous).toBe("number");
    expect(typeof report.noMatch).toBe("number");
    expect(Array.isArray(report.results)).toBe(true);
  });

  it("counts add up to scanned", async () => {
    const report = await backfillScheduleBlockTopics({ dryRun: true });
    expect(
      report.exactMatches +
        report.substringMatches +
        report.ambiguous +
        report.noMatch,
    ).toBe(report.scanned);
  });

  it("results array length equals scanned", async () => {
    const report = await backfillScheduleBlockTopics({ dryRun: true });
    expect(report.results.length).toBe(report.scanned);
  });

  it("each result carries a matchKind that's one of 4 values", async () => {
    const report = await backfillScheduleBlockTopics({ dryRun: true });
    for (const r of report.results) {
      expect(["exact", "substring_unique", "ambiguous", "no_match"]).toContain(r.matchKind);
    }
  });

  it("'exact' or 'substring_unique' results carry assignedTopicId", async () => {
    const report = await backfillScheduleBlockTopics({ dryRun: true });
    for (const r of report.results) {
      if (r.matchKind === "exact" || r.matchKind === "substring_unique") {
        expect(r.assignedTopicId).toBeGreaterThan(0);
        expect(r.assignedTopicTitle).toBeTruthy();
      }
    }
  });

  it("'ambiguous' results carry candidateTopicIds with >=2 entries", async () => {
    const report = await backfillScheduleBlockTopics({ dryRun: true });
    for (const r of report.results) {
      if (r.matchKind === "ambiguous") {
        expect(Array.isArray(r.candidateTopicIds)).toBe(true);
        expect(r.candidateTopicIds!.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("dryRun does not mutate the database (running twice yields same scanned count)", async () => {
    const a = await backfillScheduleBlockTopics({ dryRun: true });
    const b = await backfillScheduleBlockTopics({ dryRun: true });
    expect(a.scanned).toBe(b.scanned);
  });
});
