import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Phase 5 contract test. Static-only \u2014 verifies the endpoint exists with the
 * expected auth gate + weekend-roll-forward + already-scheduled guard.
 * (The endpoint POSTs to LLM, which would burn quota in a unit test, so we
 *  assert the implementation invariants by inspecting source.)
 */
describe("/api/scheduled/nightly-lesson-gen \u2014 contract", () => {
  const src = readFileSync(join(__dirname, "scheduledSync.ts"), "utf8");

  it("declares the route", () => {
    expect(src).toContain('app.post("/api/scheduled/nightly-lesson-gen"');
  });

  it("rejects anonymous callers with 401", () => {
    expect(src).toMatch(/return res\.status\(401\)\.json\(\{ ok: false, error: "Unauthorized/);
  });

  it("rolls Sat/Sun forward to next school day", () => {
    expect(src).toMatch(/while \(target\.getDay\(\) === 0 \|\| target\.getDay\(\) === 6\)/);
  });

  it("skips when next-day plan already has blocks (unless force=true)", () => {
    expect(src).toContain("status: \"skipped_existing\"");
    expect(src).toMatch(/if \(!force && \(existing as any\[\]\)\.length > 0\)/);
  });

  it("uses the same generateScheduleDraft helper as the UI", () => {
    expect(src).toContain('await import("./_lib/aiScheduleGenerator")');
    expect(src).toContain("generateScheduleDraft");
  });
});
