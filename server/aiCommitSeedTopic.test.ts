import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { curriculumTopics, scheduleBlocks, dailyPlans } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const ctxOwner = { user: { id: "owner-1", role: "owner" as const, name: "Owner", openId: "x", email: "spear.cpt@gmail.com" } };
const callerOwner = appRouter.createCaller(ctxOwner as any);

describe("plans.aiCommit — seedTopicId persistence", () => {
  it("attaches seedTopicId to every committed block when block-level topicId is missing", async () => {
    const db = getDb();
    const topic: any = (await db.select().from(curriculumTopics).limit(1))[0];
    if (!topic) return;
    // Use an arbitrary weekday in the future so we don't collide with real plans.
    const date = "2099-04-22"; // Wednesday
    await callerOwner.plans.aiCommit({
      date,
      dayLength: "full",
      summary: "test",
      replaceExisting: true,
      blocks: [
        { blockType: "math", title: "Topic-seed test block A", durationMin: 20 },
        { blockType: "custom", title: "Topic-seed test block B", durationMin: 20 },
      ],
      seedTopicId: topic.id,
    });
    const plan: any = (await db.select().from(dailyPlans).where(eq(dailyPlans.date, date)))[0];
    expect(plan).toBeTruthy();
    const blocks = await db.select().from(scheduleBlocks).where(eq(scheduleBlocks.planId, plan.id));
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const b of blocks) {
      expect((b as any).curriculumTopicId).toBe(topic.id);
    }
    // Cleanup so the test is idempotent.
    for (const b of blocks) {
      await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id, (b as any).id));
    }
    await db.delete(dailyPlans).where(eq(dailyPlans.id, plan.id));
  }, 30_000);
});
