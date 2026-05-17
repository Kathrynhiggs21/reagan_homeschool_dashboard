import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { curriculumTopics, curriculumResources } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// v2.20 (2026-05-17): writes were tightened from `protectedProcedure` to
// `familyAdminProcedure` in v2.15. The latter accepts either:
//   (a) ctx.user.role === "admin" or "tutor" (DB role check), OR
//   (b) roleForEmail(ctx.user.email) === parent | editor | tutor.
// The original test seeded role="owner" which satisfies neither, so the
// gate rightly threw FORBIDDEN. We now seed role="admin" (path a) which
// represents the same "this caller is allowed to write" intent without
// depending on the email allowlist staying in sync with test fixtures.
const ctxOwner = { user: { id: "owner-1", role: "admin" as const, name: "Owner", openId: "x" } };
const callerOwner = appRouter.createCaller(ctxOwner as any);
const callerPub = appRouter.createCaller({ user: undefined } as any);

describe("curriculum.rollup + addResource + removeResource", () => {
  it("rejects unauthenticated callers", async () => {
    await expect(callerPub.curriculum.rollup({ topicId: 1 })).rejects.toThrow();
    await expect(
      callerPub.curriculum.addResource({ topicId: 1, kind: "video", title: "x" }),
    ).rejects.toThrow();
  });

  it("adds a resource, rollup returns it, removeResource clears it, dedupes on (topicId,kind,url)", async () => {
    const db = getDb();
    const someTopic: any = (await db.select().from(curriculumTopics).limit(1))[0];
    if (!someTopic) return;
    const topicId = someTopic.id;

    const rid1 = await callerOwner.curriculum.addResource({
      topicId,
      kind: "video",
      title: "Khan: Multiplying Fractions",
      url: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-fractions-topic/cc-5th-mult-frac/v/multiplying-fractions",
      source: "khan",
    });
    expect(rid1).toBeTruthy();

    // De-dupe — same (topicId, kind, url) should return existing id.
    const rid2 = await callerOwner.curriculum.addResource({
      topicId,
      kind: "video",
      title: "Khan: Multiplying Fractions (dup)",
      url: "https://www.khanacademy.org/math/cc-fifth-grade-math/cc-5th-fractions-topic/cc-5th-mult-frac/v/multiplying-fractions",
      source: "khan",
    });
    expect(rid2).toBe(rid1);

    const rollup = await callerOwner.curriculum.rollup({ topicId });
    expect(Array.isArray(rollup.resources)).toBe(true);
    expect(Array.isArray(rollup.blocks)).toBe(true);
    expect(rollup.resources.some((r: any) => r.id === rid1)).toBe(true);

    await callerOwner.curriculum.removeResource({ id: rid1 as number });
    const after = await db.select().from(curriculumResources).where(eq(curriculumResources.id, rid1 as number));
    expect(after.length).toBe(0);
  }, 30_000);
});
