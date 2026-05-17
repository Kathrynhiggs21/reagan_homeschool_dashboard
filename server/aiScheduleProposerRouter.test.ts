import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Source-contract tests for the AI agenda diff layer wiring in
 * server/routers.ts. We don't spin up a real tRPC client here — we lock
 * the structural promises that downstream UI work will depend on.
 */

const src = fs.readFileSync(
  path.join(__dirname, "routers.ts"),
  "utf8",
);

describe("plans router — aiPropose + aiApplyProposal wiring", () => {
  it("imports proposeScheduleEdit from the proposer module", () => {
    expect(src).toContain('from "./_lib/aiScheduleProposer"');
    expect(src).toContain("proposeScheduleEdit");
  });

  it("registers plans.aiPropose as a familyAdmin mutation", () => {
    expect(src).toMatch(/aiPropose: familyAdminProcedure/);
    expect(src).toContain("await proposeScheduleEdit({");
  });

  it("registers plans.aiApplyProposal as a familyAdmin mutation", () => {
    expect(src).toMatch(/aiApplyProposal: familyAdminProcedure/);
  });

  it("aiApplyProposal accepts a discriminated union of keep/modify/remove/add decisions", () => {
    expect(src).toMatch(/z\.discriminatedUnion\(\s*"kind"/);
    expect(src).toMatch(/z\.literal\("keep"\)/);
    expect(src).toMatch(/z\.literal\("modify"\)/);
    expect(src).toMatch(/z\.literal\("remove"\)/);
    expect(src).toMatch(/z\.literal\("add"\)/);
  });

  it("aiApplyProposal applies removes BEFORE modifies BEFORE adds", () => {
    // Removes first so sortOrder gaps don't collide with new inserts.
    const removeIdx = src.indexOf('if (d.kind === "remove")');
    const modifyIdx = src.indexOf('if (d.kind === "modify")');
    const addIdx = src.indexOf('if (d.kind === "add")');
    expect(removeIdx).toBeGreaterThan(0);
    expect(modifyIdx).toBeGreaterThan(removeIdx);
    expect(addIdx).toBeGreaterThan(modifyIdx);
  });

  it("aiApplyProposal returns counts plus per-decision results: { planId, added, modified, removed, results }", () => {
    // The contract widened on 2026-05-17 to include a per-decision `results`
    // array so callers can see which individual decisions failed without
    // dropping successful ones. Lock both the counts and the results field.
    expect(src).toMatch(/return \{ planId: plan\.id, added, modified, removed, results \}/);
  });

  it("aiApplyProposal records per-decision ok/error so the UI can show partial failures", () => {
    expect(src).toMatch(/recordOk\(/);
    expect(src).toMatch(/recordFail\(/);
    // Failed decisions carry an error string
    expect(src).toMatch(/results\.push\(\{ kind, existingBlockId, ok: false, error: msg \}\)/);
  });

  it("aiApplyProposal logs an audit row with the +/~/- summary line", () => {
    expect(src).toMatch(/AI-edit applied for \$\{input\.date\}: \+\$\{added\} ~\$\{modified\} -\$\{removed\}/);
  });

  it("aiPropose stays read-only — never calls db.deleteBlock / createBlock / updateBlock", () => {
    // Slice the file to just the aiPropose body and confirm no destructive calls.
    const proposeStart = src.indexOf("aiPropose: familyAdminProcedure");
    const proposeEnd = src.indexOf("aiApplyProposal: familyAdminProcedure");
    expect(proposeStart).toBeGreaterThan(0);
    expect(proposeEnd).toBeGreaterThan(proposeStart);
    const slice = src.slice(proposeStart, proposeEnd);
    expect(slice).not.toMatch(/db\.deleteBlock\b/);
    expect(slice).not.toMatch(/db\.createBlock\b/);
    expect(slice).not.toMatch(/db\.updateBlock\b/);
  });

  it("aiPropose returns a graceful 'no plan for that date' shape (not a throw)", () => {
    expect(src).toContain('No plan for that date yet — use AI Generate first.');
  });
});
