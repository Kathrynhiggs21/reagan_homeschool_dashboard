/**
 * Push 33 (2026-05-13) — enforceTopic hard-reject mode contract.
 *
 * Locks the new opt-in mode in `aiScheduleGenerator.generateScheduleDraft`:
 *   - When `enforceTopic` is true AND the LLM returns academic blocks
 *     without a curriculumTopicCode, a single retry fires with a stricter
 *     reminder.
 *   - If those blocks STILL come back un-tagged, they are dropped (not
 *     committed) and the warnings list explains the drop count.
 *   - When `enforceTopic` is false (default), the existing warning-only
 *     path is preserved (back-compat).
 *
 * Implementation note: we mock invokeLLM at the module layer so the test
 * runs offline + deterministically.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockInvokeLLM = vi.fn();
vi.mock("./_core/llm", () => ({ invokeLLM: (...args: any[]) => mockInvokeLLM(...args) }));

import { generateScheduleDraft, type AIGenerateInput } from "./_lib/aiScheduleGenerator";

const baseInput: AIGenerateInput = {
  forDate: "2026-05-13",
  zone: "green",
  energy: "yellow",
  subjects: [
    { slug: "math", name: "Math" },
    { slug: "ela", name: "ELA" },
  ],
  topicCatalog: [
    { code: "5.OA.1", subjectSlug: "math", title: "Order of operations", status: "notStarted" } as any,
    { code: "5.OA.2", subjectSlug: "math", title: "Numerical expressions", status: "notStarted" } as any,
  ],
  dayLength: "full",
};

function llmReply(blocks: any[], summary = "auto") {
  return {
    choices: [{ message: { content: JSON.stringify({ summary, blocks }) } }],
  };
}

describe("aiScheduleGenerator enforceTopic hard-reject — push 33", () => {
  beforeEach(() => mockInvokeLLM.mockReset());

  it("default mode (enforceTopic !== true) keeps un-tagged academic blocks + emits a warning only", async () => {
    mockInvokeLLM.mockResolvedValueOnce(
      llmReply([
        { blockType: "math", title: "Math problem set", description: "", durationMin: 30, startTime: "09:00", subjectSlug: "math", curriculumTopicCode: null },
      ]),
    );
    const out = await generateScheduleDraft({ ...baseInput });
    expect(out.blocks.length).toBe(1);
    expect(mockInvokeLLM).toHaveBeenCalledTimes(1); // no retry
    expect(out.warnings.some((w) => /missing curriculumTopicCode/i.test(w))).toBe(true);
  });

  it("enforceTopic=true triggers a retry when an academic block lacks topicCode", async () => {
    // First response: missing topicCode.
    mockInvokeLLM.mockResolvedValueOnce(
      llmReply([
        { blockType: "math", title: "Math problem set", description: "", durationMin: 30, startTime: "09:00", subjectSlug: "math", curriculumTopicCode: null },
      ]),
    );
    // Retry response: model fixes itself, supplies a valid catalog code.
    mockInvokeLLM.mockResolvedValueOnce(
      llmReply([
        { blockType: "math", title: "Math problem set", description: "", durationMin: 30, startTime: "09:00", subjectSlug: "math", curriculumTopicCode: "5.OA.1" },
      ]),
    );
    const out = await generateScheduleDraft({ ...baseInput, enforceTopic: true });
    expect(mockInvokeLLM).toHaveBeenCalledTimes(2);
    expect(out.blocks.length).toBe(1);
    expect(out.blocks[0].curriculumTopicCode).toBe("5.OA.1");
    expect(out.warnings.some((w) => /hard-reject retry triggered/.test(w))).toBe(true);
  });

  it("enforceTopic=true drops academic blocks that remain un-tagged after retry (rather than committing un-tagged)", async () => {
    mockInvokeLLM.mockResolvedValueOnce(
      llmReply([
        { blockType: "math", title: "A", description: "", durationMin: 30, startTime: "09:00", subjectSlug: "math", curriculumTopicCode: null },
        { blockType: "math", title: "B", description: "", durationMin: 30, startTime: "09:30", subjectSlug: "math", curriculumTopicCode: null },
      ]),
    );
    // Retry: model still fails on one of the two.
    mockInvokeLLM.mockResolvedValueOnce(
      llmReply([
        { blockType: "math", title: "A", description: "", durationMin: 30, startTime: "09:00", subjectSlug: "math", curriculumTopicCode: "5.OA.1" },
        { blockType: "math", title: "B", description: "", durationMin: 30, startTime: "09:30", subjectSlug: "math", curriculumTopicCode: null },
      ]),
    );
    const out = await generateScheduleDraft({ ...baseInput, enforceTopic: true });
    expect(out.blocks.length).toBe(1);
    expect(out.blocks[0].title).toBe("A");
    expect(out.warnings.some((w) => /dropped 1 academic block/.test(w))).toBe(true);
  });

  it("enforceTopic=true does NOT trigger a retry when every academic block already has a topicCode", async () => {
    mockInvokeLLM.mockResolvedValueOnce(
      llmReply([
        { blockType: "math", title: "Math", description: "", durationMin: 30, startTime: "09:00", subjectSlug: "math", curriculumTopicCode: "5.OA.1" },
      ]),
    );
    const out = await generateScheduleDraft({ ...baseInput, enforceTopic: true });
    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(out.blocks.length).toBe(1);
    expect(out.warnings.some((w) => /hard-reject retry/.test(w))).toBe(false);
  });

  it("enforceTopic=true does NOT retry when the catalog is empty (offline mode)", async () => {
    mockInvokeLLM.mockResolvedValueOnce(
      llmReply([
        { blockType: "math", title: "Math", description: "", durationMin: 30, startTime: "09:00", subjectSlug: "math", curriculumTopicCode: null },
      ]),
    );
    const out = await generateScheduleDraft({ ...baseInput, topicCatalog: [], enforceTopic: true });
    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(out.blocks.length).toBe(1); // no retry, block kept (offline-tolerant)
  });

  it("enforceTopic=true does NOT touch non-academic blocks (adventure / appointment) without topicCode", async () => {
    mockInvokeLLM.mockResolvedValueOnce(
      llmReply([
        { blockType: "adventure", title: "Park walk", description: "", durationMin: 30, startTime: "09:00", subjectSlug: null, curriculumTopicCode: null },
        { blockType: "appointment", title: "Therapy", description: "", durationMin: 60, startTime: "10:00", subjectSlug: null, curriculumTopicCode: null },
      ]),
    );
    const out = await generateScheduleDraft({ ...baseInput, enforceTopic: true });
    expect(mockInvokeLLM).toHaveBeenCalledTimes(1); // no retry
    expect(out.blocks.length).toBe(2);
  });
});
