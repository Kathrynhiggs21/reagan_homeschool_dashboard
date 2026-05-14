/**
 * Overnight push 2026-05-14 — auto-grade runner contract.
 *
 * Verifies the in-process runner:
 *   - no-ops on bogus IDs
 *   - skips already-graded submissions (autoScore != null)
 *   - skips when there is no answer key for the block
 *   - records a grade + rolls into mastery for a typed submission with MC keys
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before the runner imports it.
vi.mock("../server/db", async () => {
  return await import("./__mocks__/dbAutoGradeMock");
});
vi.mock("./db", async () => {
  return await import("./__mocks__/dbAutoGradeMock");
});

// Mock the LLM helper so tests don't hit the network.
vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{ message: { content: '{"correct":true,"why":"ok"}' } }],
  })),
}));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{ message: { content: '{"correct":true,"why":"ok"}' } }],
  })),
}));

import { runAutoGradeForSubmission } from "./_lib/autoGradeRunner";
import * as mockDb from "./__mocks__/dbAutoGradeMock";

beforeEach(() => {
  (mockDb as any).__reset();
});

describe("runAutoGradeForSubmission", () => {
  it("no-ops on submissionId <= 0", async () => {
    await runAutoGradeForSubmission(0);
    await runAutoGradeForSubmission(-3);
    expect((mockDb as any).__recordedGrades).toHaveLength(0);
  });

  it("skips submissions that are already auto-graded", async () => {
    (mockDb as any).__seedSubmission({
      id: 7,
      blockId: 1,
      autoScore: 88,
      submissionType: "text",
      contentText: "A",
    });
    (mockDb as any).__seedAnswerKey(1, {
      totalPoints: 100,
      questions: [{ qId: "q1", kind: "mc", correct: "A" }],
    });
    await runAutoGradeForSubmission(7);
    expect((mockDb as any).__recordedGrades).toHaveLength(0);
  });

  it("silently skips when no answer key is set", async () => {
    (mockDb as any).__seedSubmission({
      id: 8,
      blockId: 99,
      autoScore: null,
      submissionType: "text",
      contentText: "A",
    });
    await runAutoGradeForSubmission(8);
    expect((mockDb as any).__recordedGrades).toHaveLength(0);
  });

  it("scores a perfect typed MC submission and rolls into mastery", async () => {
    (mockDb as any).__seedSubmission({
      id: 9,
      blockId: 2,
      autoScore: null,
      submissionType: "text",
      contentText: "A\nB",
      subjectSlug: "math",
      title: "Place Value",
    });
    (mockDb as any).__seedAnswerKey(2, {
      totalPoints: 100,
      questions: [
        { qId: "q1", kind: "mc", correct: "A" },
        { qId: "q2", kind: "mc", correct: "B" },
      ],
    });
    await runAutoGradeForSubmission(9);
    expect((mockDb as any).__recordedGrades).toHaveLength(1);
    const g = (mockDb as any).__recordedGrades[0];
    expect(g.submissionId).toBe(9);
    expect(g.autoScore).toBe(100);
    expect(g.autoLetter).toBe("A");
    expect((mockDb as any).__masteryWrites).toContainEqual({
      subjectSlug: "math",
      skillName: "Place Value",
      score: 100,
    });
  });
});
