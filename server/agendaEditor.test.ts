/**
 * Pure-logic tests for the Manus-style AI Agenda Editor lib.
 *
 * We don't hit the LLM here — `generateAgendaEditPlan` is exercised live
 * through the tRPC `preview` procedure and the schema enforcement keeps the
 * shape stable. These tests cover the validation + apply layer that turns an
 * arbitrary EditPlan into a deterministic block list, which is what Apply
 * commits to the DB.
 */
import { describe, it, expect } from "vitest";
import {
  validateEditPlan,
  applyEditPlanInMemory,
  type AgendaEditPlan,
  type AgendaPlanContext,
  type AgendaBlockSnapshot,
} from "./_lib/agendaEditor";

function block(id: number, partial: Partial<AgendaBlockSnapshot> = {}): AgendaBlockSnapshot {
  return {
    id,
    title: `Block ${id}`,
    description: null,
    blockType: "math",
    startTime: "09:00",
    durationMin: 30,
    sortOrder: id,
    status: "not_started",
    subjectSlug: "math",
    curriculumTopicCode: "M.1",
    ...partial,
  };
}

function ctx(blocks: AgendaBlockSnapshot[]): AgendaPlanContext {
  return {
    planId: 1,
    date: "2026-05-04",
    dayLabel: "Monday, May 4",
    studentName: "Reagan",
    gradeLevel: "5th grade",
    tutorOfDayLabel: null,
    blocks,
    subjects: [
      { slug: "math", name: "Math" },
      { slug: "ela", name: "ELA" },
    ],
    topicCatalog: [
      { code: "M.1", title: "Place value", subjectSlug: "math" },
      { code: "ELA.2", title: "Theme", subjectSlug: "ela" },
    ],
  };
}

describe("validateEditPlan", () => {
  it("drops update ops referencing unknown block ids", () => {
    const plan: AgendaEditPlan = {
      summary: "test", intent: "surgical", warnings: [],
      ops: [
        { kind: "update", id: 999, title: "ghost" },
        { kind: "update", id: 1, title: "real" },
      ],
    };
    const out = validateEditPlan(plan, ctx([block(1)]));
    expect(out.ops).toHaveLength(1);
    expect((out.ops[0] as any).id).toBe(1);
    expect(out.warnings.some(w => w.includes("999"))).toBe(true);
  });

  it("clamps durationMin to [5,180]", () => {
    const plan: AgendaEditPlan = {
      summary: "test", intent: "surgical", warnings: [],
      ops: [{ kind: "update", id: 1, durationMin: 500 }],
    };
    const out = validateEditPlan(plan, ctx([block(1)]));
    expect((out.ops[0] as any).durationMin).toBe(180);
  });

  it("drops unknown subjectSlug + topic code", () => {
    const plan: AgendaEditPlan = {
      summary: "test", intent: "surgical", warnings: [],
      ops: [{ kind: "update", id: 1, subjectSlug: "alchemy", curriculumTopicCode: "ZZZ.99" }],
    };
    const out = validateEditPlan(plan, ctx([block(1)]));
    expect((out.ops[0] as any).subjectSlug).toBeUndefined();
    expect((out.ops[0] as any).curriculumTopicCode).toBeUndefined();
  });
});

describe("applyEditPlanInMemory", () => {
  it("update op patches one block", () => {
    const c = ctx([block(1, { title: "old" }), block(2)]);
    const plan: AgendaEditPlan = {
      summary: "rename", intent: "surgical", warnings: [],
      ops: [{ kind: "update", id: 1, title: "Nature walk", blockType: "adventure" }],
    };
    const after = applyEditPlanInMemory(c, plan);
    expect(after[0].title).toBe("Nature walk");
    expect(after[0].blockType).toBe("adventure");
    expect(after[1].title).toBe("Block 2");
  });

  it("shiftAll moves every startTime", () => {
    const c = ctx([block(1, { startTime: "09:00" }), block(2, { startTime: "10:30" })]);
    const after = applyEditPlanInMemory(c, {
      summary: "later start", intent: "bulk", warnings: [],
      ops: [{ kind: "shiftAll", minutes: 60 }],
    });
    expect(after[0].startTime).toBe("10:00");
    expect(after[1].startTime).toBe("11:30");
  });

  it("reorder rearranges blocks and keeps unmentioned ones at end", () => {
    const c = ctx([block(1), block(2), block(3)]);
    const after = applyEditPlanInMemory(c, {
      summary: "reorder", intent: "bulk", warnings: [],
      ops: [{ kind: "reorder", orderedIds: [3, 1] }],
    });
    expect(after.map(b => b.id)).toEqual([3, 1, 2]);
    expect(after.map(b => b.sortOrder)).toEqual([0, 1, 2]);
  });

  it("insert with afterBlockId places block immediately after", () => {
    const c = ctx([block(1), block(2)]);
    const after = applyEditPlanInMemory(c, {
      summary: "insert", intent: "add", warnings: [],
      ops: [{
        kind: "insert", title: "Snack", blockType: "choice",
        durationMin: 15, afterBlockId: 1,
      }],
    });
    expect(after).toHaveLength(3);
    expect(after[0].id).toBe(1);
    expect(after[1].title).toBe("Snack");
    expect(after[1].id).toBeLessThan(0); // synthetic
    expect(after[2].id).toBe(2);
  });

  it("delete removes a block", () => {
    const c = ctx([block(1), block(2), block(3)]);
    const after = applyEditPlanInMemory(c, {
      summary: "drop", intent: "remove", warnings: [],
      ops: [{ kind: "delete", id: 2 }],
    });
    expect(after.map(b => b.id)).toEqual([1, 3]);
  });

  it("composite plan: shiftAll + insert + update applied in order", () => {
    const c = ctx([block(1, { startTime: "09:00" }), block(2, { startTime: "10:00" })]);
    const after = applyEditPlanInMemory(c, {
      summary: "shorter+fun", intent: "mixed", warnings: [],
      ops: [
        { kind: "shiftAll", minutes: -30 },
        { kind: "update", id: 1, durationMin: 20 },
        { kind: "insert", title: "Adventure", blockType: "adventure", durationMin: 30, afterBlockId: 2 },
      ],
    });
    expect(after[0].startTime).toBe("08:30");
    expect(after[0].durationMin).toBe(20);
    expect(after[1].startTime).toBe("09:30");
    expect(after[2].title).toBe("Adventure");
  });
});
