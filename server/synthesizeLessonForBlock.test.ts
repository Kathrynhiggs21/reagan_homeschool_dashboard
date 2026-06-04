/**
 * v3.31 (2026-06-04) — synthesizeLessonForBlock retry + deterministic-fallback.
 *
 * Locks the new behavior:
 *   - The LLM is retried once on a transient failure.
 *   - If the LLM still fails OR returns empty practice, a deterministic
 *     no-LLM fallback worksheet is used (never null, never empty).
 *   - The Ohio standard code is stamped onto the lesson.
 *
 * invokeLLM and the db layer are mocked at the module boundary so the test
 * runs offline + deterministically.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockInvokeLLM = vi.fn();
vi.mock("./_core/llm", () => ({
  invokeLLM: (...args: any[]) => mockInvokeLLM(...args),
}));

// DB cache layer: no cached row, and accept writes silently.
const mockListAssignmentsLibrary = vi.fn(async () => [] as any[]);
const mockAddAssignmentLibrary = vi.fn(async () => ({ id: 1 }));
vi.mock("./db", () => ({
  listAssignmentsLibrary: (...a: any[]) => mockListAssignmentsLibrary(...a),
  addAssignmentLibrary: (...a: any[]) => mockAddAssignmentLibrary(...a),
}));

import { synthesizeLessonForBlock } from "./_lib/synthesizeLessonForBlock";

const baseInput = {
  blockId: 555,
  blockTitle: "Decimals Practice",
  blockDescription: null,
  subjectSlug: "math",
  subjectName: "Math",
  durationMin: 30,
  dateStr: "2026-06-05",
  standardCode: "5.NBT.5",
};

function llmReply(obj: unknown) {
  return { choices: [{ message: { content: JSON.stringify(obj) } }] };
}

const goodSynth = {
  objectives: ["Add decimals", "Subtract decimals"],
  instructions: "Solve each problem on paper.",
  practice: [
    { q: "1.2 + 3.4 =", a: "4.6" },
    { q: "5.0 - 1.5 =", a: "3.5" },
    { q: "2.25 + 0.75 =", a: "3.00" },
  ],
  bookReference: null,
};

describe("v3.31 — synthesizeLessonForBlock", () => {
  beforeEach(() => {
    mockInvokeLLM.mockReset();
    mockListAssignmentsLibrary.mockClear();
    mockAddAssignmentLibrary.mockClear();
    mockListAssignmentsLibrary.mockResolvedValue([]);
  });

  it("uses the LLM result when valid and stamps the standard code", async () => {
    mockInvokeLLM.mockResolvedValueOnce(llmReply(goodSynth));
    const lesson = await synthesizeLessonForBlock(baseInput);
    expect(lesson).not.toBeNull();
    expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    expect(lesson!.worksheets?.[0]?.questions?.length).toBe(3);
    expect(lesson!.instructions).toContain("5.NBT.5");
  });

  it("retries the LLM once on a transient throw, then succeeds", async () => {
    mockInvokeLLM
      .mockRejectedValueOnce(new Error("503 transient"))
      .mockResolvedValueOnce(llmReply(goodSynth));
    const lesson = await synthesizeLessonForBlock(baseInput);
    expect(mockInvokeLLM).toHaveBeenCalledTimes(2);
    expect(lesson).not.toBeNull();
    expect(lesson!.worksheets?.[0]?.questions?.length).toBe(3);
  });

  it("falls back deterministically when the LLM fails both attempts", async () => {
    mockInvokeLLM
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"));
    const lesson = await synthesizeLessonForBlock(baseInput);
    expect(mockInvokeLLM).toHaveBeenCalledTimes(2);
    expect(lesson).not.toBeNull();
    // Fallback always produces >=3 questions + an answer key.
    expect(
      (lesson!.worksheets?.[0]?.questions ?? []).length,
    ).toBeGreaterThanOrEqual(3);
    expect((lesson!.answerKey ?? "").trim().length).toBeGreaterThan(0);
    // Standard code still stamped via the fallback path.
    expect(lesson!.instructions).toContain("5.NBT.5");
  });

  it("falls back when the LLM returns empty practice", async () => {
    mockInvokeLLM.mockResolvedValue(
      llmReply({ objectives: [], instructions: "", practice: [], bookReference: null }),
    );
    const lesson = await synthesizeLessonForBlock(baseInput);
    expect(lesson).not.toBeNull();
    expect(
      (lesson!.worksheets?.[0]?.questions ?? []).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("the deterministic fallback is itself cached (best-effort write)", async () => {
    mockInvokeLLM.mockRejectedValue(new Error("down"));
    await synthesizeLessonForBlock(baseInput);
    // A fallback should attempt to persist to the library cache.
    expect(mockAddAssignmentLibrary).toHaveBeenCalled();
  });
});
