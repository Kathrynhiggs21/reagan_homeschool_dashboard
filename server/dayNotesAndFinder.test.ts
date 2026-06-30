import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the LLM, finder, and DB layer so the router behavior is testable without network.
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{ message: { content: "{}" } }],
  })),
}));

vi.mock("./_lib/assignmentFinder", () => ({
  findAssignments: vi.fn(async () => [
    {
      title: "Fractions practice",
      url: "https://khanacademy.org/x",
      type: "video",
      subjectSlug: "math",
      curriculumTopicCode: "5.NF.1",
      estimatedMinutes: 12,
      source: "sonar_web",
      description: "good intro",
    },
  ]),
}));

const insertedNotes: any[] = [];

vi.mock("./db", () => ({
  __esModule: true,
  insertTutorDayNote: vi.fn(async (n: any) => {
    insertedNotes.push(n);
    return { id: 99 };
  }),
  listTutorDayNotes: vi.fn(async () => []),
  listRecentTutorDayNotes: vi.fn(async () => []),
  deleteTutorDayNote: vi.fn(async () => ({ ok: true })),
  ensurePlanForDate: vi.fn(async () => ({ id: 1 })),
  createBlock: vi.fn(async () => 7),
  // Stubs needed because routers.ts imports the namespace
  listSchoolDays: vi.fn(async () => []),
  listOffDays: vi.fn(async () => []),
  listCurriculumTopics: vi.fn(async () => []),
  getWorksheetPdfCache: vi.fn(async () => null),
  upsertWorksheetPdfCache: vi.fn(async () => ({ id: 1, updated: false })),
}));

beforeEach(() => {
  insertedNotes.length = 0;
});

// Bring in routers AFTER mocks
const routersImport = import("./routers");

async function callTutorDayNotesAdd(role: string | null) {
  const m = await routersImport;
  const caller = m.appRouter.createCaller({
    user: role ? { role, openId: "u-1", name: "Tester" } as any : null,
  } as any);
  return caller.tutorDayNotes.add({
    dateStr: "2026-05-04",
    tutorName: "Marcy",
    notes: "Reagan was sharp on math; struggled with grammar exercises.",
    topicsCovered: "5.OA.1, 5.L.1",
    comfort: "stretched",
  });
}

async function callFindAssignments(role: string | null) {
  const m = await routersImport;
  const caller = m.appRouter.createCaller({
    user: role ? { role, openId: "u-1", name: "Tester" } as any : null,
  } as any);
  return caller.adultAi.findAssignments({
    query: "fractions practice",
    kidSafe: false,
  });
}

describe("Tutor Day Notes — role gating", () => {
  it("admin can add a note", async () => {
    const r = await callTutorDayNotesAdd("admin");
    expect(r.ok).toBe(true);
    expect(insertedNotes).toHaveLength(1);
    expect(insertedNotes[0].tutorName).toBe("Marcy");
    expect(insertedNotes[0].notes).toMatch(/Reagan was sharp/);
  });

  it("tutor can add a note", async () => {
    const r = await callTutorDayNotesAdd("tutor");
    expect(r.ok).toBe(true);
    expect(insertedNotes).toHaveLength(1);
  });

  it("kid (user role) cannot add a note", async () => {
    await expect(callTutorDayNotesAdd("user")).rejects.toThrow(/adults/i);
    expect(insertedNotes).toHaveLength(0);
  });

  it("anonymous cannot add a note", async () => {
    await expect(callTutorDayNotesAdd(null)).rejects.toBeTruthy();
    expect(insertedNotes).toHaveLength(0);
  });
});

describe("Adult AI assignment-finder — role gating", () => {
  it("admin gets results", async () => {
    const r: any = await callFindAssignments("admin");
    expect(r.count).toBeGreaterThan(0);
    expect(r.results[0].curriculumTopicCode).toBe("5.NF.1");
  });

  it("tutor gets results", async () => {
    const r: any = await callFindAssignments("tutor");
    expect(r.count).toBeGreaterThan(0);
  });

  it("kid (user role) is rejected", async () => {
    await expect(callFindAssignments("user")).rejects.toThrow(/admins and tutors/i);
  });
});
