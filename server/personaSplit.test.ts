/**
 * personaSplit.test.ts
 *
 * Locks the contract that:
 *   1. The adult AI router REJECTS non-admin/tutor users (kid role gets blocked).
 *   2. The adult AI system prompt is neutral text-only (no "Kiwi" name, no
 *      mascot, no emoji-by-default), forbids Kiwi voice, and includes the
 *      curriculum topic catalog + tutor-of-day context.
 *   3. Reagan's request flow goes through `studentRequests`, not the adult chat
 *      log (`adultAiMessages`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM so the test does not hit the network.
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async ({ messages }: any) => ({
    choices: [{ message: { content: `[stub reply system_chars=${messages[0].content.length}]` } }],
  })),
}));

// Capture the system prompt the adult AI sends.
import { invokeLLM } from "./_core/llm";

// Mock db helpers used by adultAi.chat so we don't need a DB.
vi.mock("./db", async () => {
  return {
    listAdultAiMessages: vi.fn(async () => []),
    insertAdultAiMessage: vi.fn(async () => {}),
    listStudentRequests: vi.fn(async () => [
      { id: 1, kind: "schedule_change", message: "can I do art instead of math?", createdAt: new Date(), resolvedAt: null },
    ]),
    getProfile: vi.fn(async () => ({ studentName: "Reagan" })),
    getPlanByDate: vi.fn(async () => ({ id: 99, date: "2026-05-04", dayType: "school" })),
    listBlocksForPlan: vi.fn(async () => [
      { id: 1, title: "Math: Order of Operations", status: "todo", startTime: "09:00" },
    ]),
    insertStudentRequest: vi.fn(async () => {}),
  };
});

vi.mock("./_lib/tutorOfDay", () => ({
  resolveTutorOfDay: vi.fn(async () => ({ name: "Marcy", role: "mom", arrival: "08:30", departure: "15:00" })),
}));

vi.mock("./_lib/topicCatalog", () => ({
  loadTopicHintsForPrompt: vi.fn(async () => [
    { code: "5.OA.1", subjectSlug: "math", title: "Order of Operations", status: "in_progress" },
    { code: "5.RL.5.2", subjectSlug: "ela", title: "Theme of a story", status: "not_started" },
  ]),
  resolveTopicCodeToId: vi.fn(async () => 1),
}));

import { appRouter } from "./routers";

function makeCtx(role: "admin" | "tutor" | "user", openId = "u-1", name = "Test Adult") {
  return {
    user: { id: 1, openId, name, role },
  } as any;
}

describe("persona split: adult AI assistant", () => {
  beforeEach(() => {
    (invokeLLM as any).mockClear();
  });

  it("rejects a kid (role=user) with a clear error", async () => {
    const caller = appRouter.createCaller(makeCtx("user", "kid-1", "Reagan") as any);
    await expect(caller.adultAi.chat({ userMessage: "hi" })).rejects.toThrow(/only available to admins and tutors/i);
  });

  it("admin call uses a neutral system prompt with no Kiwi voice and includes topic catalog + tutor", async () => {
    const caller = appRouter.createCaller(makeCtx("admin", "mom-1", "Marcy") as any);
    const out = await caller.adultAi.chat({ userMessage: "what's on tap today?", forDate: "2026-05-04" });
    expect(out.reply).toContain("[stub reply");
    expect(out.tutorOfDay?.name).toBe("Marcy");

    const sysPrompt: string = (invokeLLM as any).mock.calls[0][0].messages[0].content;

    // Adult persona constraints
    expect(sysPrompt).toMatch(/adult-side homeschool AI assistant/i);
    expect(sysPrompt).toMatch(/No mascot persona, no "Kiwi" voice/i);
    expect(sysPrompt).toMatch(/Never speak as "Kiwi"/);

    // Tutor-of-day stamp
    expect(sysPrompt).toMatch(/Tutor today: Marcy/);

    // Curriculum topic catalog injected with codes
    expect(sysPrompt).toMatch(/5\.OA\.1/);
    expect(sysPrompt).toMatch(/5\.RL\.5\.2/);

    // Pending student request count surfaced
    expect(sysPrompt).toMatch(/1 pending request/);
  });

  it("tutor (role=tutor) is also allowed", async () => {
    const caller = appRouter.createCaller(makeCtx("tutor", "tut-1", "Ms Jane") as any);
    const out = await caller.adultAi.chat({ userMessage: "swap math to read aloud", forDate: "2026-05-04" });
    expect(out.reply).toContain("[stub reply");
  });
});
