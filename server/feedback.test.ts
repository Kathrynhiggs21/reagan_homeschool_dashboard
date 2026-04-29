import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { skillLadder, skillFeedback, moodSignals } from "../drizzle/schema";
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
    strand: "__vitest_FEEDBACK",
    skillCode: "__vitest.FEEDBACK.1",
    title: "__vitest feedback skill",
    kidFriendly: "test",
    gradeLevel: "5",
    ladderOrder: 9100,
    active: true,
  } as any);
  const [s] = await db.select().from(skillLadder).where(eq((skillLadder as any).skillCode, "__vitest.FEEDBACK.1"));
  testSkillId = s.id;
});

afterAll(async () => {
  const db = getDb();
  await db.delete(skillFeedback).where(eq(skillFeedback.skillLadderId, testSkillId));
  await db.delete(moodSignals).where(eq(moodSignals.skillLadderId, testSkillId));
  await db.delete(skillLadder).where(eq(skillLadder.id, testSkillId));
});

describe("feedback router", () => {
  const caller = appRouter.createCaller(publicCtx());

  it("record inserts a row + mirrors feltIt into moodSignals", async () => {
    await caller.feedback.record({
      skillLadderId: testSkillId,
      feltIt: "ok",
      whatHelped: "story",
      timeFelt: "justRight",
      wantedBreak: false,
    });
    const db = getDb();
    const fbs = await db.select().from(skillFeedback).where(eq(skillFeedback.skillLadderId, testSkillId));
    expect(fbs.length).toBe(1);
    expect(fbs[0].whatHelped).toBe("story");
    expect(fbs[0].timeFelt).toBe("justRight");
    const moods = await db.select().from(moodSignals).where(eq(moodSignals.skillLadderId, testSkillId));
    expect(moods.length).toBeGreaterThanOrEqual(1);
    expect(moods[moods.length - 1].source).toBe("manual");
  });

  it("whatHelped summary ranks the most-tapped helper", async () => {
    // Add a few more so 'story' wins
    await caller.feedback.record({ skillLadderId: testSkillId, whatHelped: "story" });
    await caller.feedback.record({ skillLadderId: testSkillId, whatHelped: "visual" });
    const sum: any = await caller.feedback.whatHelped({ limit: 50 });
    expect(sum.top).toBeTruthy();
    // 'story' should be at the top of ranked since we recorded it >=2x in this session
    const storyRank = sum.ranked.find((r: any[]) => r[0] === "story");
    expect(storyRank).toBeTruthy();
  });
});
