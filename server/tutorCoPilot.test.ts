/**
 * tutorCoPilot.test.ts
 *
 * Locks the contract for the new adult AI block-edit tools:
 *  - kid (role=user) cannot call any tool
 *  - admin can swap / soften / postpone / add blocks
 *  - tutor can do the same only when a tutor-of-day exists for today
 *  - addBlock requires a known curriculum topic code (otherwise rejects)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture last update / create calls.
const updates: any[] = [];
const creates: any[] = [];

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({ choices: [{ message: { content: "ok" } }] })),
}));

vi.mock("./db", async () => {
  return {
    listAdultAiMessages: vi.fn(async () => []),
    insertAdultAiMessage: vi.fn(async () => {}),
    listStudentRequests: vi.fn(async () => []),
    getProfile: vi.fn(async () => ({ studentName: "Reagan" })),
    getPlanByDate: vi.fn(async () => null),
    listBlocksForPlan: vi.fn(async () => []),
    getBlock: vi.fn(async (id: number) => ({ id, planId: 7, title: "Math", durationMin: 30, notes: null })),
    updateBlock: vi.fn(async (id: number, patch: any) => { updates.push({ id, patch }); }),
    createBlock: vi.fn(async (b: any) => { creates.push(b); return 999; }),
    ensurePlanForDate: vi.fn(async (date: string) => ({ id: 7, dateStr: date })),
  };
});

let tutorOfDayValue: any = { name: "Marcy", role: "mom", arrival: "08:30", departure: "15:00", source: "tutor_session", sourceId: 1 };
vi.mock("./_lib/tutorOfDay", () => ({
  resolveTutorOfDay: vi.fn(async () => tutorOfDayValue),
  tutorOfDayLabel: (t: any) => t?.name || "—",
}));

vi.mock("./_lib/topicCatalog", () => ({
  loadTopicHintsForPrompt: vi.fn(async () => []),
  resolveTopicId: vi.fn(async (code: string) => (code === "5.OA.1" ? 42 : null)),
  resolveTopicIds: vi.fn(async (codes: string[]) => {
    const m = new Map<string, number>();
    for (const c of codes) if (c === "5.OA.1") m.set(c, 42);
    return m;
  }),
}));

import { appRouter } from "./routers";

function ctx(role: "admin" | "tutor" | "user", name = "Tester") {
  return { user: { id: 1, openId: `u-${role}`, name, role } } as any;
}

describe("tutor co-pilot tools", () => {
  beforeEach(() => {
    updates.length = 0;
    creates.length = 0;
    tutorOfDayValue = { name: "Marcy", role: "mom", arrival: "08:30", departure: "15:00", source: "tutor_session", sourceId: 1 };
  });

  it("kid cannot call any block-edit tool", async () => {
    const c = appRouter.createCaller(ctx("user", "Reagan"));
    await expect(c.adultAi.swapBlock({ blockId: 5, newTitle: "Art" })).rejects.toThrow(/forbidden/i);
    await expect(c.adultAi.softenBlock({ blockId: 5 })).rejects.toThrow(/forbidden/i);
    await expect(c.adultAi.postponeBlock({ blockId: 5, toDate: "2026-05-05" })).rejects.toThrow(/forbidden/i);
    await expect(c.adultAi.addBlock({ dateStr: "2026-05-04", title: "X", subjectSlug: "math", curriculumTopicCode: "5.OA.1" })).rejects.toThrow(/forbidden/i);
  });

  it("admin can swap a block — updates title and stamps an audit note", async () => {
    const c = appRouter.createCaller(ctx("admin", "Marcy"));
    const r = await c.adultAi.swapBlock({ blockId: 5, newTitle: "Art instead", reason: "low energy" });
    expect(r.ok).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0].patch.title).toBe("Art instead");
    expect(updates[0].patch.notes).toMatch(/swap by Marcy/);
  });

  it("admin can soften a block — duration drops, status enum stays valid", async () => {
    const c = appRouter.createCaller(ctx("admin", "Marcy"));
    const r = await c.adultAi.softenBlock({ blockId: 5, reduceMinutesBy: 10 });
    expect(r.ok).toBe(true);
    expect(r.newDuration).toBe(20);
    expect(updates[0].patch.title).toMatch(/lighter version/);
  });

  it("admin can postpone a block to another date — status uses 'not_started'", async () => {
    const c = appRouter.createCaller(ctx("admin", "Marcy"));
    const r = await c.adultAi.postponeBlock({ blockId: 5, toDate: "2026-05-06" });
    expect(r.ok).toBe(true);
    expect(updates[0].patch.status).toBe("not_started");
    expect(updates[0].patch.planId).toBe(7);
  });

  it("admin can add a block when topic code is known", async () => {
    const c = appRouter.createCaller(ctx("admin", "Marcy"));
    const r = await c.adultAi.addBlock({ dateStr: "2026-05-04", title: "Bonus math", subjectSlug: "math", curriculumTopicCode: "5.OA.1" });
    expect(r.ok).toBe(true);
    expect(r.blockId).toBe(999);
    expect(creates).toHaveLength(1);
    expect(creates[0].curriculumTopicId).toBe(42);
  });

  it("addBlock rejects unknown topic codes", async () => {
    const c = appRouter.createCaller(ctx("admin", "Marcy"));
    await expect(c.adultAi.addBlock({ dateStr: "2026-05-04", title: "Bonus", subjectSlug: "math", curriculumTopicCode: "9.ZZ.1" })).rejects.toThrow(/Unknown curriculum topic/);
  });

  it("tutor can swap when a tutor-of-day exists today", async () => {
    const c = appRouter.createCaller(ctx("tutor", "Ms Jane"));
    const r = await c.adultAi.swapBlock({ blockId: 5, newTitle: "Read aloud" });
    expect(r.ok).toBe(true);
  });

  it("tutor cannot swap when no tutor-of-day is set", async () => {
    tutorOfDayValue = null;
    const c = appRouter.createCaller(ctx("tutor", "Ms Jane"));
    await expect(c.adultAi.swapBlock({ blockId: 5, newTitle: "Read aloud" })).rejects.toThrow(/No tutor scheduled/);
  });

  it("tutor cannot add a block for a date other than today", async () => {
    const c = appRouter.createCaller(ctx("tutor", "Ms Jane"));
    const farFuture = "2099-01-01";
    await expect(c.adultAi.addBlock({ dateStr: farFuture, title: "X", subjectSlug: "math", curriculumTopicCode: "5.OA.1" })).rejects.toThrow(/today's date/);
  });
});
