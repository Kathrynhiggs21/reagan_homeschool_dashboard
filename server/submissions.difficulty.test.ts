/**
 * Tests for the new turn-in metadata fields:
 *   - kidDifficulty (Easy / Just right / Tricky / Really hard)
 *   - readingCheckmark (one-tap "✓ Done reading" path)
 *
 * Both are encoded into the existing `adultNotes` column as a structured
 * tag prefix `[difficulty=...;reading_checkmark=1]` so we can ship without
 * a schema migration tonight. Analytics + Adult Library both parse this.
 */
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function publicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("submissions.create — kidDifficulty + readingCheckmark", () => {
  it("encodes a difficulty rating into adultNotes", async () => {
    const spy = vi
      .spyOn(db, "createAssignmentSubmission")
      .mockResolvedValue({ id: 999 } as any);

    const caller = appRouter.createCaller(publicCtx());
    await caller.submissions.create({
      blockId: 12345,
      mode: "typed",
      answersText: "answer 1",
      kidDifficulty: "tricky",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const call: any = spy.mock.calls[0]?.[0];
    expect(call.adultNotes).toBe("[difficulty=tricky]");
    expect(call.contentText).toBe("answer 1");
    expect(call.submissionType).toBe("text");
    spy.mockRestore();
  });

  it("encodes a reading checkmark into adultNotes and overrides contentText", async () => {
    const spy = vi
      .spyOn(db, "createAssignmentSubmission")
      .mockResolvedValue({ id: 1000 } as any);

    const caller = appRouter.createCaller(publicCtx());
    await caller.submissions.create({
      blockId: 22222,
      mode: "typed",
      readingCheckmark: true,
      kidDifficulty: "easy",
    });

    const call: any = spy.mock.calls[0]?.[0];
    expect(call.adultNotes).toBe("[difficulty=easy;reading_checkmark=1]");
    expect(call.contentText).toBe("✓ Done reading");
    expect(call.submissionType).toBe("text");
    spy.mockRestore();
  });

  it("omits adultNotes entirely when neither tag is provided", async () => {
    const spy = vi
      .spyOn(db, "createAssignmentSubmission")
      .mockResolvedValue({ id: 1001 } as any);

    const caller = appRouter.createCaller(publicCtx());
    await caller.submissions.create({
      blockId: 333,
      mode: "photo",
      fileKey: "k",
      fileUrl: "/manus-storage/k",
    });

    const call: any = spy.mock.calls[0]?.[0];
    expect(call.adultNotes).toBeUndefined();
    expect(call.submissionType).toBe("photo");
    spy.mockRestore();
  });
});
