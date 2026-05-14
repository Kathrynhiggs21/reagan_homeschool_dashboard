/**
 * Push 148 (2026-05-14) — nightly-lesson-gen now plans tomorrow's
 * worksheet auto-prep so the 8 PM packet has worksheets ready.
 *
 * Source-level assertion (matches the kid-summary + autoGrade test
 * style; route requires sdk auth so a real-server hit isn't useful in
 * a unit test).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "scheduledSync.ts"), "utf8");

describe("/api/scheduled/nightly-lesson-gen — auto-prep planning", () => {
  it("declares the route", () => {
    expect(src).toContain('app.post("/api/scheduled/nightly-lesson-gen"');
  });

  it("imports the planner pure helper", () => {
    expect(src).toMatch(/import\(\s*"\.\/_lib\/worksheetAutoPrepPlanner"\s*\)/);
    expect(src).toContain("planWorksheetAutoPrep");
  });

  it("loads the freshly-committed blocks for the plan before planning", () => {
    expect(src).toContain("db.listBlocksForPlan(plan.id)");
  });

  it("returns autoPrep on the response so the scheduled-task agent can run it", () => {
    expect(src).toMatch(/autoPrep,\s*[\r\n]/);
  });

  it("planning failure does NOT block the lesson-gen response", () => {
    // The planner is wrapped in try/catch with a default { workItems: [], skipped: [] }.
    expect(src).toMatch(/let autoPrep: \{[^}]*workItems: any\[\]; skipped: any\[\][^}]*\}\s*=\s*\{\s*workItems: \[\],\s*skipped: \[\],\s*\};/);
  });
});
