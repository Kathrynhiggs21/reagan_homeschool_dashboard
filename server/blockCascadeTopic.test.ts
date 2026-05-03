import { describe, it, expect } from "vitest";
import { getDb, updateBlock, createBlock } from "./db";
import { scheduleBlocks, curriculumTopics, dailyPlans } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

describe("scheduleBlock completion cascades to curriculum topic", () => {
  it("flips curriculumTopic to done when its block is marked complete", async () => {
    const db = getDb();

    // Pick any topic and force it back to notStarted for this test.
    const someTopic: any = (await db.select().from(curriculumTopics).limit(1))[0];
    if (!someTopic) return;
    const topicId = someTopic.id;
    await db.execute(sql`UPDATE curriculumTopics SET status = 'notStarted' WHERE id = ${topicId}`);

    // Need a plan to attach to. Reuse latest, otherwise fabricate.
    const planRows: any = await db.select().from(dailyPlans).limit(1);
    let planId = planRows[0]?.id;
    if (!planId) {
      const inserted: any = await db.insert(dailyPlans).values({ date: new Date() } as any);
      planId = inserted?.[0]?.insertId;
    }

    const blockId = await createBlock({
      planId,
      blockType: "math",
      title: "TEST cascade block",
      durationMin: 5,
      status: "not_started",
      sortOrder: 999,
      curriculumTopicId: topicId,
    } as any);

    // Mark complete -> topic should flip to done.
    await updateBlock(blockId as number, { status: "complete" } as any);

    const after = await db.select().from(curriculumTopics).where(eq(curriculumTopics.id, topicId));
    expect((after[0] as any).status).toBe("done");

    // Cleanup.
    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id, blockId as number));
  }, 30_000);

  it("flips notStarted topic to inProgress when its block is set in_progress", async () => {
    const db = getDb();

    // Find a notStarted topic (Q4 should still have some).
    const todoRows: any = await db.execute(
      sql`SELECT id FROM curriculumTopics WHERE status = 'notStarted' LIMIT 1`,
    );
    const list: any[] = Array.isArray(todoRows) ? todoRows[0] ?? todoRows : todoRows.rows ?? [];
    if (!list.length) return;
    const topicId = list[0].id;

    const planRows: any = await db.select().from(dailyPlans).limit(1);
    const planId = planRows[0]?.id;
    if (!planId) return;

    const blockId = await createBlock({
      planId,
      blockType: "math",
      title: "TEST in-progress cascade",
      durationMin: 5,
      status: "not_started",
      sortOrder: 999,
      curriculumTopicId: topicId,
    } as any);

    await updateBlock(blockId as number, { status: "in_progress" } as any);

    const after = await db.select().from(curriculumTopics).where(eq(curriculumTopics.id, topicId));
    expect((after[0] as any).status).toBe("inProgress");

    // Cleanup: revert topic, delete block.
    await db.execute(sql`UPDATE curriculumTopics SET status = 'notStarted' WHERE id = ${topicId}`);
    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id, blockId as number));
  }, 30_000);
});
