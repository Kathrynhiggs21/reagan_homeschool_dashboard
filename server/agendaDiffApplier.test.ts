/**
 * Push 105 (2026-05-13) — Agenda prompt diff applier contract.
 *
 * Pairs with Push 88's parser to lock the "preview → apply" flow:
 * the server writes only what the UI showed Mom.
 */
import { describe, it, expect } from "vitest";
import {
  applyDirectivesAsDiff,
  parseAgendaPromptToDirectives,
  type BlockSnapshot,
} from "./_lib/agendaPromptParser";
import { applyAgendaDiff } from "./_lib/agendaDiffApplier";

function snap(): BlockSnapshot[] {
  return [
    { id: 1, title: "Math warmup", subjectSlug: "math", durationMin: 30 },
    { id: 2, title: "Reading", subjectSlug: "ela", durationMin: 25 },
    { id: 3, title: "Science", subjectSlug: "science", durationMin: 45, status: "complete" },
    { id: 4, title: "Free read", subjectSlug: "ela", durationMin: 20 },
  ];
}

describe("Push 105 — agenda diff applier", () => {
  it("shorter day reduces every non-complete block to its diffed duration", () => {
    const blocks = snap();
    const directives = parseAgendaPromptToDirectives("make it shorter please");
    const diff = applyDirectivesAsDiff(blocks, directives);
    const r = applyAgendaDiff(blocks, diff);
    const byId = new Map(r.blocks.map((b) => [b.id, b]));
    expect(byId.get(1)!.durationMin).toBe(Math.round(30 * 0.75));
    expect(byId.get(2)!.durationMin).toBe(Math.round(25 * 0.75));
    expect(byId.get(4)!.durationMin).toBe(Math.round(20 * 0.75));
    // Complete block untouched.
    expect(byId.get(3)!.durationMin).toBe(45);
    expect(r.appliedOpCount).toBeGreaterThan(0);
  });

  it("complete blocks are NEVER mutated", () => {
    const blocks = snap();
    const directives = parseAgendaPromptToDirectives("longer day with more fun");
    const diff = applyDirectivesAsDiff(blocks, directives);
    const r = applyAgendaDiff(blocks, diff);
    const complete = r.blocks.find((b) => b.id === 3)!;
    expect(complete.durationMin).toBe(45);
    expect(complete.status).toBe("complete");
    expect(complete.flags ?? []).toEqual([]);
  });

  it("skip-subject directive marks matching blocks as skipped, not deleted", () => {
    const blocks = snap();
    const directives = parseAgendaPromptToDirectives("no science today");
    const diff = applyDirectivesAsDiff(blocks, directives);
    const r = applyAgendaDiff(blocks, diff);
    // The complete science block remains complete (never mutated).
    expect(r.blocks.find((b) => b.id === 3)!.status).toBe("complete");
    expect(r.blocks).toHaveLength(4); // No deletion
  });

  it("markFun and markEasy append non-destructive flags + are idempotent", () => {
    const blocks = snap();
    const directives = parseAgendaPromptToDirectives("ease up and make it fun");
    const diff = applyDirectivesAsDiff(blocks, directives);

    const r1 = applyAgendaDiff(blocks, diff);
    for (const b of r1.blocks) {
      if (b.id === 3) continue; // complete
      expect(b.flags).toContain("fun");
      expect(b.flags).toContain("easy");
    }
    // Re-apply same diff to the result → no new ops applied.
    const r2 = applyAgendaDiff(r1.blocks, diff);
    expect(r2.appliedOpCount).toBe(0);
  });

  it("updateDuration is idempotent (re-apply yields same blocks)", () => {
    const blocks = snap();
    const directives = parseAgendaPromptToDirectives("add 10 minutes to math");
    const diff = applyDirectivesAsDiff(blocks, directives);
    const r1 = applyAgendaDiff(blocks, diff);
    const r2 = applyAgendaDiff(r1.blocks, diff);
    expect(r2.appliedOpCount).toBe(0);
    expect(r2.blocks.find((b) => b.id === 1)!.durationMin).toBe(
      r1.blocks.find((b) => b.id === 1)!.durationMin,
    );
  });

  it("unknown blockIds in ops are silently ignored", () => {
    const blocks = snap();
    const diff = {
      ops: [
        {
          kind: "updateDuration" as const,
          blockId: 9999,
          before: 30,
          after: 20,
          reason: "ghost block",
        },
      ],
      summary: "",
      directives: [],
    };
    const r = applyAgendaDiff(blocks, diff);
    expect(r.appliedOpCount).toBe(0);
    expect(r.ignoredOpCount).toBe(1);
    // Real blocks untouched.
    expect(r.blocks.map((b) => b.durationMin)).toEqual([30, 25, 45, 20]);
  });

  it("perBlockReasons captures rationale for each touched block", () => {
    const blocks = snap();
    const directives = parseAgendaPromptToDirectives("add 5 minutes to math");
    const diff = applyDirectivesAsDiff(blocks, directives);
    const r = applyAgendaDiff(blocks, diff);
    expect(r.perBlockReasons[1]?.[0]).toMatch(/add 5 min to math/);
    // Non-math blocks untouched.
    expect(r.perBlockReasons[2]).toBeUndefined();
  });

  it("empty diff returns blocks unchanged with 0 applied ops", () => {
    const blocks = snap();
    const r = applyAgendaDiff(blocks, { ops: [], summary: "", directives: [] });
    expect(r.appliedOpCount).toBe(0);
    expect(r.ignoredOpCount).toBe(0);
    expect(r.blocks.map((b) => b.durationMin)).toEqual([30, 25, 45, 20]);
  });

  it("ordering of returned blocks is preserved from input", () => {
    const blocks = snap();
    const directives = parseAgendaPromptToDirectives("make it shorter");
    const diff = applyDirectivesAsDiff(blocks, directives);
    const r = applyAgendaDiff(blocks, diff);
    expect(r.blocks.map((b) => b.id)).toEqual([1, 2, 3, 4]);
  });
});
