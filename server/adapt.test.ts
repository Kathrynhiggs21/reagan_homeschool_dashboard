import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { skillLadder, skillFeedback, moodSignals, adaptiveHints, parentFlags, skillProgress } from "../drizzle/schema";
import { eq } from "drizzle-orm";

function publicCtx(): TrpcContext {
  return {
    user: null as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

let testSkillId: number;

beforeAll(async () => {
  const db = getDb();
  await db.insert(skillLadder).values({
    subjectSlug: "math",
    strand: "TEST_ADAPT",
    skillCode: "TEST.ADAPT.1",
    title: "TEST ADAPT skill",
    kidFriendly: "test",
    gradeLevel: "5",
    ladderOrder: 9200,
    active: true,
  } as any);
  const [s] = await db.select().from(skillLadder).where(eq((skillLadder as any).skillCode, "TEST.ADAPT.1"));
  testSkillId = s.id;
});

afterAll(async () => {
  const db = getDb();
  await db.delete(parentFlags).where(eq(parentFlags.skillLadderId, testSkillId));
  await db.delete(adaptiveHints).where(eq(adaptiveHints.skillLadderId, testSkillId));
  await db.delete(skillFeedback).where(eq(skillFeedback.skillLadderId, testSkillId));
  await db.delete(moodSignals).where(eq(moodSignals.skillLadderId, testSkillId));
  await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
  await db.delete(skillLadder).where(eq(skillLadder.id, testSkillId));
});

describe("adaptation engine v2", () => {
  const caller = appRouter.createCaller(publicCtx());

  it("after a clear 'whatHelped' winner, hint suggests that mode", async () => {
    await caller.feedback.record({ skillLadderId: testSkillId, feltIt: "ok", whatHelped: "story" });
    await caller.feedback.record({ skillLadderId: testSkillId, feltIt: "ok", whatHelped: "story" });
    const hint: any = await caller.adapt.hintFor({ skillLadderId: testSkillId });
    expect(hint).toBeTruthy();
    expect(hint.suggestedMode).toBe("story");
    expect(hint.softerNext).toBe(false);
  });

  it("2+ Hard signals flips softerNext=true and rotates suggested mode", async () => {
    await caller.feedback.record({ skillLadderId: testSkillId, feltIt: "hard", whatHelped: "practice" });
    await caller.feedback.record({ skillLadderId: testSkillId, feltIt: "hard", whatHelped: "practice" });
    const hint: any = await caller.adapt.hintFor({ skillLadderId: testSkillId });
    expect(hint.softerNext).toBe(true);
    expect(hint.suggestedMode).not.toBe("practice");
  });

  it("3 hard rounds in a row creates a parentFlag", async () => {
    // Already 2 hards above; add 1 more for a stack of 3 most-recent hards
    await caller.feedback.record({ skillLadderId: testSkillId, feltIt: "hard", whatHelped: "practice" });
    const flags: any = await caller.parentFlags.list({ unacknowledgedOnly: true });
    const ours = (flags as any[]).find((f) => f.skillLadderId === testSkillId);
    expect(ours).toBeTruthy();
    expect(ours.severity).toBe("watch");
  });

  it("softerNext blocks level-up on the very next practice round", async () => {
    // Force a high confidence + 3 evidence so without softerNext she WOULD level up
    const db = getDb();
    await db.insert(skillProgress).values({
      skillLadderId: testSkillId, level: 0, confidence: 70, evidenceCount: 2,
    } as any).onDuplicateKeyUpdate({ set: { level: 0, confidence: 70, evidenceCount: 2 } as any });
    // softerNext is currently true from above
    const before = (await db.select().from(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId)))[0];
    await caller.skillLadder.practice({ skillLadderId: testSkillId, mode: "story", selfRating: 5 });
    const after = (await db.select().from(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId)))[0];
    expect(after.level).toBe(before.level); // level held even though confidence climbed
  });
});
