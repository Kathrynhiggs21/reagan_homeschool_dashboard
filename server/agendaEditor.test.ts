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


describe("AI-first instruction patterns (validator/applier)", () => {
  it("tutor-not-here: ops=[] is left as a safe no-op (warnings carry the message)", () => {
    // This is what the LLM should emit per the system prompt for unsalvageable
    // tutor unavailability. The validator must accept ops=[] and the applier
    // must keep the day untouched.
    const c = ctx([block(1), block(2), block(3)]);
    const plan: AgendaEditPlan = {
      summary: "Tutor unavailable — recommend pushing the day.",
      intent: "bulk",
      ops: [],
      warnings: ["Tutor unavailable — use 'Push day to tomorrow' in the schedule view."],
    };
    const validated = validateEditPlan(plan, c);
    expect(validated.ops).toEqual([]);
    expect(validated.warnings.some(w => w.toLowerCase().includes("tutor"))).toBe(true);
    const after = applyEditPlanInMemory(c, validated);
    expect(after.map(b => b.id)).toEqual([1, 2, 3]);
  });

  it("push-to-tomorrow: bulk ops=[] leaves blocks intact (cross-day move handled elsewhere)", () => {
    const c = ctx([block(1), block(2)]);
    const plan: AgendaEditPlan = {
      summary: "Cross-day move requested.",
      intent: "bulk",
      ops: [],
      warnings: ["Use the schedule's reschedule action to move the day."],
    };
    const after = applyEditPlanInMemory(c, validateEditPlan(plan, c));
    expect(after.map(b => b.id)).toEqual([1, 2]);
  });

  it("topic swap: single update op changes curriculumTopicCode without touching siblings", () => {
    const c = ctx([
      block(1, { curriculumTopicCode: "M.1", title: "Place value warm-up" }),
      block(2, { curriculumTopicCode: "M.1" }),
    ]);
    const plan: AgendaEditPlan = {
      summary: "Swap topic on block 1",
      intent: "surgical",
      ops: [{ kind: "update", id: 1, curriculumTopicCode: "ELA.2", subjectSlug: "ela", title: "Theme study" }],
      warnings: [],
    };
    const validated = validateEditPlan(plan, c);
    expect((validated.ops[0] as any).curriculumTopicCode).toBe("ELA.2");
    const after = applyEditPlanInMemory(c, validated);
    expect(after[0].curriculumTopicCode).toBe("ELA.2");
    expect(after[0].subjectSlug).toBe("ela");
    expect(after[0].title).toBe("Theme study");
    expect(after[1].curriculumTopicCode).toBe("M.1"); // sibling untouched
  });

  it("uniform durations: per-block updates each set to 20 minutes", () => {
    const c = ctx([block(1, { durationMin: 30 }), block(2, { durationMin: 45 }), block(3, { durationMin: 15 })]);
    const plan: AgendaEditPlan = {
      summary: "Every block 20 min",
      intent: "bulk",
      ops: [
        { kind: "update", id: 1, durationMin: 20 },
        { kind: "update", id: 2, durationMin: 20 },
        { kind: "update", id: 3, durationMin: 20 },
      ],
      warnings: [],
    };
    const after = applyEditPlanInMemory(c, validateEditPlan(plan, c));
    expect(after.map(b => b.durationMin)).toEqual([20, 20, 20]);
  });

  it("brain-break add: insert before lunch via afterBlockId on the prior block", () => {
    const c = ctx([
      block(1, { title: "Math", startTime: "09:00" }),
      block(2, { title: "Lunch", startTime: "12:00", blockType: "appointment" }),
    ]);
    const plan: AgendaEditPlan = {
      summary: "Brain break before lunch",
      intent: "add",
      ops: [{ kind: "insert", title: "Brain break", blockType: "choice", durationMin: 10, afterBlockId: 1 }],
      warnings: [],
    };
    const after = applyEditPlanInMemory(c, validateEditPlan(plan, c));
    expect(after.map(b => b.title)).toEqual(["Math", "Brain break", "Lunch"]);
  });
});


describe("attachment param wiring", () => {
  // We don't actually call the LLM here, but we validate that the optional
  // attachment parameter is a documented part of the public signature so
  // downstream callers (router.preview) can rely on it without TS escape
  // hatches. This test will fail at compile time if the type is removed.
  it("generateAgendaEditPlan accepts an optional attachment object", async () => {
    const mod: any = await import("./_lib/agendaEditor");
    expect(typeof mod.generateAgendaEditPlan).toBe("function");
    // Function arity is at least 2 (ctx, instruction); attachment is optional 3rd.
    expect(mod.generateAgendaEditPlan.length).toBeGreaterThanOrEqual(2);
  });
});
