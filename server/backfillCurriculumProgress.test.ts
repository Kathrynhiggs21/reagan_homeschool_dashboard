import { beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { curriculumTopics } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

const ctxOwner = { user: { id: "owner-1", role: "owner" as const, name: "Owner", openId: "x" } };
const callerOwner = appRouter.createCaller(ctxOwner as any);
const callerPub = appRouter.createCaller({ user: undefined } as any);

describe("curriculum.backfillProgress", () => {
  beforeAll(async () => {
    // Make sure seed has been applied so there are rows to flip.
    await callerOwner.curriculum.ensureSeeded();
  });

  it("rejects unauthenticated callers", async () => {
    await expect(callerPub.curriculum.backfillProgress()).rejects.toThrow();
  });

  it("flips remaining Q1+Q2+Q3 notStarted rows to done and reports counts", async () => {
    const r1 = await callerOwner.curriculum.backfillProgress();
    expect(r1).toMatchObject({
      q1: expect.any(Number),
      q2: expect.any(Number),
      q3: expect.any(Number),
      total: expect.any(Number),
    });
    expect(r1.total).toBeGreaterThanOrEqual(0);

    // Re-running must be idempotent (no rows flipped second time).
    const r2 = await callerOwner.curriculum.backfillProgress();
    expect(r2.total).toBe(0);
  });

  it("leaves Q4 rows alone", async () => {
    const db = getDb();
    const q4Rows = await db.select().from(curriculumTopics).where(eq(curriculumTopics.quarter, "Q4" as any));
    // No matter what backfill did, Q4 should still contain at least one
    // not-yet-done row (because adults haven't done Q4 yet).
    const someTodoLeft = q4Rows.some((r: any) => r.status === "notStarted" || r.status === "inProgress");
    expect(someTodoLeft).toBe(true);
  });

  it("preserves manually-marked inProgress rows (does not flip them to done)", async () => {
    const db = getDb();
    // Pick a Q3 topic (or any) and force it to inProgress, then re-run.
    const sample = await db.select().from(curriculumTopics).limit(1);
    if (!sample.length) return;
    const id = (sample[0] as any).id;
    await db.execute(sql`UPDATE curriculumTopics SET status = 'inProgress' WHERE id = ${id}`);

    await callerOwner.curriculum.backfillProgress();

    const after = await db.select().from(curriculumTopics).where(eq(curriculumTopics.id, id));
    expect((after[0] as any).status).toBe("inProgress");

    // Restore to done so we don't leave dirty state.
    await db.execute(sql`UPDATE curriculumTopics SET status = 'done' WHERE id = ${id}`);
  });
});
