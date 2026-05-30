import { describe, it, expect } from "vitest";
import { addReviewQuestion } from "./db";

/**
 * Regression: prior to 2026-05-29, `addReviewQuestion` was called with
 * `sessionId: undefined` because `createReviewSession` returned `id: undefined`
 * from a mis-shaped drizzle/mysql2 result. Drizzle then silently inserted
 * `(default, default, ?, ?, ?, ?, ?, ?, default)` and TiDB rejected with a
 * NOT NULL violation on `sessionId`. The fix in `createReviewSession` now
 * resolves the real insertId via shape-detection + read-back fallback, and
 * `addReviewQuestion` now eagerly rejects invalid sessionIds before touching
 * the DB so the failure mode is obvious in logs.
 */
describe("addReviewQuestion — input validation guard", () => {
  it("rejects undefined sessionId before touching the DB", async () => {
    await expect(
      addReviewQuestion({
        sessionId: undefined as any,
        questionType: "multiple-choice",
        question: "What is 2+2?",
        correctAnswer: "4",
      }),
    ).rejects.toThrow(/invalid sessionId/);
  });

  it("rejects NaN sessionId", async () => {
    await expect(
      addReviewQuestion({
        sessionId: NaN,
        questionType: "multiple-choice",
        question: "What is 2+2?",
        correctAnswer: "4",
      }),
    ).rejects.toThrow(/invalid sessionId/);
  });

  it("rejects 0 sessionId (would silently insert as default)", async () => {
    await expect(
      addReviewQuestion({
        sessionId: 0,
        questionType: "multiple-choice",
        question: "What is 2+2?",
        correctAnswer: "4",
      }),
    ).rejects.toThrow(/invalid sessionId/);
  });

  it("rejects null sessionId", async () => {
    await expect(
      addReviewQuestion({
        sessionId: null as any,
        questionType: "multiple-choice",
        question: "What is 2+2?",
        correctAnswer: "4",
      }),
    ).rejects.toThrow(/invalid sessionId/);
  });
});
