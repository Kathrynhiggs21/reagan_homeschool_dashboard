import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { placementTasks, placementResponses, skillLadder, skillProgress, proudMoments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Diagnostic Placement smoke tests.
 *
 * 1. status returns per-subject + overall percentages
 * 2. tasks lists tasks for a subject with skill metadata
 * 3. submit auto-grades pickOne tasks and once all 3 tasks for a skill are
 *    answered, writes a placement level (0..2) into skillProgress without
 *    creating a celebratory proud-moment.
 */

function publicCtx(): TrpcContext {
  return {
    user: null as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

let testSkillId: number;
let taskIds: number[] = [];

beforeAll(async () => {
  const db = getDb();
  // Create an isolated test skill with 3 placement tasks (don't pollute Reagan's data)
  await db.insert(skillLadder).values({
    subjectSlug: "math",
    strand: "TEST_STRAND_PLACEMENT",
    skillCode: "TEST.PLACEMENT.1",
    title: "TEST PLACEMENT skill",
    kidFriendly: "test",
    gradeLevel: "5",
    ladderOrder: 9999,
    active: true,
  } as any);
  const [s] = await db.select().from(skillLadder).where(eq((skillLadder as any).skillCode, "TEST.PLACEMENT.1"));
  testSkillId = s.id;
  // Insert 3 placement tasks
  const taskSpecs = [
    { taskOrder: 0, gradeLevel: "4", taskType: "pickOne" as const, kidPrompt: "What is 2 + 2?", choices: ["3","4","5"], correctAnswer: "4" },
    { taskOrder: 1, gradeLevel: "5", taskType: "pickOne" as const, kidPrompt: "What is 12 + 13?", choices: ["24","25","26"], correctAnswer: "25" },
    { taskOrder: 2, gradeLevel: "6", taskType: "pickOne" as const, kidPrompt: "What is 35 + 47?", choices: ["72","82","92"], correctAnswer: "82" },
  ];
  for (const t of taskSpecs) {
    await db.insert(placementTasks).values({
      skillLadderId: testSkillId,
      taskOrder: t.taskOrder,
      gradeLevel: t.gradeLevel,
      taskType: t.taskType,
      kidPrompt: t.kidPrompt,
      choices: t.choices,
      correctAnswer: t.correctAnswer,
      active: true,
    } as any);
  }
  const fetched = await db.select().from(placementTasks).where(eq(placementTasks.skillLadderId, testSkillId));
  taskIds = fetched.sort((a,b) => a.taskOrder - b.taskOrder).map((t) => t.id);
  // Wipe any stale state for this test skill
  await db.delete(placementResponses).where(eq(placementResponses.skillLadderId, testSkillId));
  await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
});

afterAll(async () => {
  const db = getDb();
  await db.delete(placementResponses).where(eq(placementResponses.skillLadderId, testSkillId));
  await db.delete(placementTasks).where(eq(placementTasks.skillLadderId, testSkillId));
  await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
  await db.delete(proudMoments).where(eq(proudMoments.skillLadderId, testSkillId));
  await db.delete(skillLadder).where(eq(skillLadder.id, testSkillId));
});

describe("placement.status", () => {
  const caller = appRouter.createCaller(publicCtx());
  it("returns subjects array + overall percent shape", async () => {
    const status = await caller.placement.status();
    expect(status).toBeTruthy();
    expect(Array.isArray((status as any).subjects)).toBe(true);
    expect(typeof (status as any).percentOverall).toBe("number");
  });
});

describe("placement.tasks", () => {
  const caller = appRouter.createCaller(publicCtx());
  it("lists math tasks with skill metadata", async () => {
    const list: any[] = await caller.placement.tasks({ subjectSlug: "math" });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    // The first row must include the joined skill metadata
    expect(list[0]).toHaveProperty("skillTitle");
    expect(list[0]).toHaveProperty("kidPrompt");
    expect(list[0]).toHaveProperty("subjectSlug", "math");
  });
});

describe("placement.submit", () => {
  const caller = appRouter.createCaller(publicCtx());

  it("auto-grades pickOne correctly", async () => {
    const res: any = await caller.placement.submit({
      placementTaskId: taskIds[0], kidAnswer: "4", feltIt: "easy",
    });
    expect(res.isCorrect).toBe(true);
    expect(res.allDone).toBe(false);
  });

  it("places skill at the right level once all 3 tasks are answered, without a proud-moment", async () => {
    // Answer task 1 correctly + felt easy, task 2 wrong + felt hard
    await caller.placement.submit({ placementTaskId: taskIds[1], kidAnswer: "25", feltIt: "easy" });
    const final: any = await caller.placement.submit({ placementTaskId: taskIds[2], kidAnswer: "72", feltIt: "hard" });
    expect(final.allDone).toBe(true);
    // 2 correct (1.0+1.0) + 2 easy (0.5+0.5) - 1 hard (0.5) = 2.5 -> level 2
    expect(final.placedAt).toBe(2);

    const db = getDb();
    const [progress] = await db.select().from(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
    expect(progress).toBeTruthy();
    expect(progress.level).toBe(2);

    // Should NOT have created a celebratory proud-moment
    const moments = await db.select().from(proudMoments).where(eq(proudMoments.skillLadderId, testSkillId));
    expect(moments.length).toBe(0);
  });
});
