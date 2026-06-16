import { describe, it, expect } from "vitest";
import {
  buildDeterministicEditPlan,
  type AgendaPlanContext,
  type AgendaBlockSnapshot,
} from "./_lib/agendaEditor";

function makeCtx(blocks: Partial<AgendaBlockSnapshot>[]): AgendaPlanContext {
  return {
    planId: 1,
    date: "2026-06-18",
    dayLabel: "Thursday, June 18",
    studentName: "Reagan",
    gradeLevel: "5th grade",
    tutorOfDayLabel: null,
    blocks: blocks.map((b, i) => ({
      id: b.id ?? i + 1,
      title: b.title ?? `Block ${i + 1}`,
      description: b.description ?? null,
      blockType: b.blockType ?? "custom",
      startTime: b.startTime ?? null,
      durationMin: b.durationMin ?? 30,
      sortOrder: b.sortOrder ?? i,
      status: b.status ?? "not_started",
      subjectSlug: b.subjectSlug ?? null,
      curriculumTopicCode: b.curriculumTopicCode ?? null,
    })),
    subjects: [
      { slug: "math", name: "Math" },
      { slug: "ela", name: "ELA" },
      { slug: "science", name: "Science" },
      { slug: "social-studies", name: "Social Studies" },
      { slug: "specials", name: "Specials" },
    ],
    topicCatalog: [],
  };
}

describe("buildDeterministicEditPlan", () => {
  it("adds a timed math block from a natural-language request", () => {
    const ctx = makeCtx([{ id: 10, blockType: "math", subjectSlug: "math", startTime: "10:00" }]);
    const plan = buildDeterministicEditPlan(ctx, "Add a 30 minute math block at 9am about adding fractions");
    const insert = plan.ops.find((o) => o.kind === "insert") as any;
    expect(insert).toBeTruthy();
    expect(insert.durationMin).toBe(30);
    expect(insert.startTime).toBe("09:00");
    expect(insert.blockType).toBe("math");
    expect(insert.subjectSlug).toBe("math");
  });

  it("shortens every editable block when asked to make it shorter", () => {
    const ctx = makeCtx([
      { id: 1, durationMin: 40 },
      { id: 2, durationMin: 20 },
      { id: 3, durationMin: 60, status: "complete" },
    ]);
    const plan = buildDeterministicEditPlan(ctx, "make today shorter and lighter");
    const updates = plan.ops.filter((o) => o.kind === "update") as any[];
    // completed block (id 3) must be left alone
    expect(updates.some((u) => u.id === 3)).toBe(false);
    expect(updates.length).toBeGreaterThan(0);
    const u1 = updates.find((u) => u.id === 1);
    expect(u1.durationMin).toBeLessThan(40);
  });

  it("drops a subject's blocks when asked to skip it", () => {
    const ctx = makeCtx([
      { id: 1, blockType: "math", subjectSlug: "math" },
      { id: 2, blockType: "adventure", subjectSlug: "science" },
    ]);
    const plan = buildDeterministicEditPlan(ctx, "no science today");
    const deletes = plan.ops.filter((o) => o.kind === "delete") as any[];
    expect(deletes).toHaveLength(1);
    expect(deletes[0].id).toBe(2);
  });

  it("shifts the day to a requested start time", () => {
    const ctx = makeCtx([
      { id: 1, startTime: "10:00" },
      { id: 2, startTime: "10:40" },
    ]);
    const plan = buildDeterministicEditPlan(ctx, "start at 9");
    const shift = plan.ops.find((o) => o.kind === "shiftAll") as any;
    expect(shift).toBeTruthy();
    expect(shift.minutes).toBe(-60);
  });

  it("adds time to a targeted subject", () => {
    const ctx = makeCtx([
      { id: 1, blockType: "math", subjectSlug: "math", durationMin: 30 },
      { id: 2, blockType: "read_aloud", subjectSlug: "ela", durationMin: 30 },
    ]);
    const plan = buildDeterministicEditPlan(ctx, "more math today");
    const updates = plan.ops.filter((o) => o.kind === "update") as any[];
    expect(updates.some((u) => u.id === 1 && u.durationMin > 30)).toBe(true);
  });

  it("combines an add with a shorten request in one message", () => {
    const ctx = makeCtx([
      { id: 1, blockType: "math", subjectSlug: "math", durationMin: 40, startTime: "09:00" },
      { id: 2, blockType: "read_aloud", subjectSlug: "ela", durationMin: 40, startTime: "09:40" },
    ]);
    const plan = buildDeterministicEditPlan(
      ctx,
      "Make today a little shorter and add a fun 25 minute nature walk in the afternoon",
    );
    const insert = plan.ops.find((o) => o.kind === "insert") as any;
    const updates = plan.ops.filter((o) => o.kind === "update") as any[];
    expect(insert).toBeTruthy();
    expect(insert.durationMin).toBe(25);
    expect(updates.length).toBeGreaterThan(0); // shorten also applied
  });

  it("returns zero ops for an unmappable request", () => {
    const ctx = makeCtx([{ id: 1, durationMin: 30 }]);
    const plan = buildDeterministicEditPlan(ctx, "tell me a joke about parakeets");
    expect(plan.ops).toHaveLength(0);
  });
});
