import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { skillLadder, skillProgress, proudMoments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Skill Ladder + Proud Moments smoke tests.
 *
 * These cover the catch-up engine + confidence engine wiring:
 *   1. Public list of the ladder includes seeded skills, each with a progress row.
 *   2. nextUp returns the lowest-level skill in priority subject order.
 *   3. practice() bumps confidence, eventually levels up after 3+ evidence at conf>=75,
 *      and creates an "auto" proud moment on level-up.
 *   4. Public proud.add records a Reagan-sourced moment and proud.heart toggles it.
 */

function createPublicCtx(): TrpcContext {
  return {
    user: null as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

let testSkillId: number;

beforeAll(async () => {
  // Insert an isolated test skill so we don't churn the seeded ladder
  const db = getDb();
  await db.insert(skillLadder).values({
    subjectSlug: "math",
    strand: "TEST_STRAND",
    title: "TEST: vitest skill",
    kidFriendly: "Just for testing.",
    gradeLevel: "5",
    ladderOrder: 9999,
    storyHook: null,
    visualHook: null,
    handsOnHook: null,
    khanUrl: null,
    ixlUrl: null,
    skillCode: "TEST.5.1",
    active: true,
  } as any);
  const [row] = await db.select().from(skillLadder).where(eq((skillLadder as any).skillCode, "TEST.5.1"));
  testSkillId = row.id;
  // Clean any leftover progress for this test skill from prior runs
  await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
});

afterAll(async () => {
  // CRITICAL: tests must NOT leak rows into Adult Analytics tables.
  const db = getDb();
  await db.delete(proudMoments).where(eq(proudMoments.skillLadderId, testSkillId));
  // Anything Reagan-sourced from this test
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`DELETE FROM proudMoments WHERE title LIKE 'VITEST%' OR title LIKE '%vitest%'`);
  await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
  await db.delete(skillLadder).where(eq(skillLadder.id, testSkillId));
});

describe("skillLadder", () => {
  const caller = appRouter.createCaller(createPublicCtx());

  it("lists the seeded ladder with progress rows", async () => {
    const list = await caller.skillLadder.list({ subjectSlug: "math" });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    // Every skill should have a progress object
    for (const s of list as any[]) {
      expect(s.progress).toBeDefined();
      expect(typeof s.progress.level).toBe("number");
    }
  });

  it("returns a next-up skill", async () => {
    const next = await caller.skillLadder.nextUp({ subjectSlug: "math" });
    expect(next).toBeTruthy();
    expect((next as any).id).toBeGreaterThan(0);
  });

  it("practice bumps confidence and eventually levels up + creates a proud moment", async () => {
    // Three rounds of "Got it!" should push conf above 75 and trigger level-up
    let result;
    for (let i = 0; i < 3; i++) {
      result = await caller.skillLadder.practice({
        skillLadderId: testSkillId,
        mode: "practice",
        selfRating: 5,
      });
    }
    expect(result?.newLevel).toBeGreaterThanOrEqual(1);

    // A proud moment should now exist linked to this skill
    const db = getDb();
    const moments = await db.select().from(proudMoments).where(eq(proudMoments.skillLadderId, testSkillId));
    expect(moments.length).toBeGreaterThanOrEqual(1);
    expect(moments[0].source).toBe("auto");
    expect(moments[0].title).toMatch(/Leveled up/i);
  });

  it("subject-level summary returns per-subject mastery + grade level", async () => {
    const summary = await caller.skillLadder.summary();
    expect(Array.isArray(summary)).toBe(true);
    const math = (summary as any[]).find((r) => r.subjectSlug === "math");
    expect(math).toBeTruthy();
    expect(math.skills).toBeGreaterThan(0);
    expect(math.gradeLevel).toBe("5");
  });
});

describe("proud", () => {
  const caller = appRouter.createCaller(createPublicCtx());

  it("public can add a Reagan-sourced proud moment", async () => {
    const list = await caller.proud.add({
      title: "VITEST: I figured out a thing",
      source: "reagan",
      category: "effort",
      emoji: "💪",
    });
    expect(Array.isArray(list)).toBe(true);
    const found = (list as any[]).find((m) => m.title === "VITEST: I figured out a thing");
    expect(found).toBeTruthy();
    expect(found.source).toBe("reagan");
  });

  it("heart marks a moment as Reagan-hearted", async () => {
    // pick the first moment we just inserted
    const list = await caller.proud.list({ limit: 5 });
    const target = (list as any[]).find((m) => m.title === "VITEST: I figured out a thing");
    expect(target).toBeTruthy();
    const ok = await caller.proud.heart({ id: target.id });
    expect(ok).toBe(true);
    const after = await caller.proud.list({ limit: 5 });
    const refreshed = (after as any[]).find((m) => m.id === target.id);
    expect(refreshed.reaganHearted).toBe(true);
  });
});
