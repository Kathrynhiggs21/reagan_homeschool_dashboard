import { describe, it, expect, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb, buildWeeklyDigestPayload, saveWeeklyDigest, listRecentDigests, markDigestEmailed } from "./db";
import { weeklyDigests } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

const ctxOwner = { user: { id: "owner-1", role: "owner" as const, name: "Owner", openId: "x" } };
const callerOwner = appRouter.createCaller(ctxOwner as any);
const callerPub = appRouter.createCaller({ user: undefined } as any);

const insertedDigestIds: number[] = [];

afterAll(async () => {
  const db = getDb();
  if (insertedDigestIds.length) {
    await db.delete(weeklyDigests).where(inArray(weeklyDigests.id, insertedDigestIds));
  }
});

describe("weekly digest", () => {
  it("buildWeeklyDigestPayload returns the expected shape", async () => {
    const p = await buildWeeklyDigestPayload();
    expect(p).toBeTruthy();
    expect(typeof p.weekStart).toBe("string");
    expect(typeof p.weekEnd).toBe("string");
    expect(Array.isArray(p.levelUps)).toBe(true);
    expect(typeof p.tutorSessionsCount).toBe("number");
    expect(typeof p.flagsCount).toBe("number");
    expect(p.moodArc).toBeTruthy();
    expect(typeof p.moodArc.total).toBe("number");
    expect(Array.isArray(p.whatHelped)).toBe(true);
    expect(Array.isArray(p.subjectSummary)).toBe(true);
    expect(Array.isArray(p.ihAlignment)).toBe(true);
    expect(typeof p.generatedAt).toBe("string");
  });

  it("saveWeeklyDigest inserts a row with status=pending", async () => {
    const p = await buildWeeklyDigestPayload();
    const id = await saveWeeklyDigest(p);
    expect(typeof id).toBe("number");
    insertedDigestIds.push(id as number);

    const db = getDb();
    const rows = await db.select().from(weeklyDigests).where(eq(weeklyDigests.id, id as number));
    expect(rows.length).toBe(1);
    expect((rows[0] as any).emailStatus).toBe("pending");
    expect((rows[0] as any).emailedAt ?? null).toBeNull();
  });

  it("markDigestEmailed flips status to sent + sets emailedAt", async () => {
    const p = await buildWeeklyDigestPayload();
    const id = (await saveWeeklyDigest(p)) as number;
    insertedDigestIds.push(id);

    await markDigestEmailed(id, "sent");

    const db = getDb();
    const rows = await db.select().from(weeklyDigests).where(eq(weeklyDigests.id, id));
    expect((rows[0] as any).emailStatus).toBe("sent");
    expect((rows[0] as any).emailedAt).toBeTruthy();
  });

  it("markDigestEmailed accepts failed", async () => {
    const p = await buildWeeklyDigestPayload();
    const id = (await saveWeeklyDigest(p)) as number;
    insertedDigestIds.push(id);
    await markDigestEmailed(id, "failed");

    const db = getDb();
    const rows = await db.select().from(weeklyDigests).where(eq(weeklyDigests.id, id));
    expect((rows[0] as any).emailStatus).toBe("failed");
  });

  it("listRecentDigests returns digests sorted by weekStart desc", async () => {
    const recent = await listRecentDigests(20);
    expect(Array.isArray(recent)).toBe(true);
    // every saved id from this test should be present
    for (const id of insertedDigestIds) {
      expect(recent.find((d: any) => d.id === id)).toBeTruthy();
    }
    // sorted desc by weekStart
    for (let i = 1; i < recent.length; i++) {
      const a = new Date(recent[i - 1].weekStart).getTime();
      const b = new Date(recent[i].weekStart).getTime();
      expect(a).toBeGreaterThanOrEqual(b);
    }
  });

  it("digest.preview tRPC requires auth", async () => {
    await expect(callerPub.digest.preview()).rejects.toThrow(/login|auth|UNAUTHORIZED/i);
  });

  it("digest.preview tRPC returns payload for an authed parent", async () => {
    const p: any = await callerOwner.digest.preview();
    expect(p).toBeTruthy();
    expect(typeof p.weekStart).toBe("string");
    expect(Array.isArray(p.levelUps)).toBe(true);
  });

  it("digest.recent tRPC returns recent rows", async () => {
    const r: any = await callerOwner.digest.recent({ limit: 5 });
    expect(Array.isArray(r)).toBe(true);
  });
});
