import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { skillLadder, skillProgress, moodSignals, gamePrefs, gameBreakLog, proudMoments } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Phase 5 — game-as-reward + mood break engine.
 *
 * Verifies:
 *  1. games.list returns the seeded preferences
 *  2. recording 2 "Hard" practice rounds within the window flips suggestBreak=true
 *  3. recording 2 "Got it!" practice rounds with no Hard flips suggestReward=true
 *  4. logBreak inserts a row with the right reason
 */

function publicCtx(): TrpcContext {
  return {
    user: null as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

let testSkillId: number;
let testGameId: number;

beforeAll(async () => {
  const db = getDb();
  // Insert an isolated test skill
  await db.insert(skillLadder).values({
    subjectSlug: "math",
    strand: "TEST_GAMES",
    skillCode: "TEST.GAMES.1",
    title: "TEST GAMES skill",
    kidFriendly: "test",
    gradeLevel: "5",
    ladderOrder: 9000,
    active: true,
  } as any);
  const [s] = await db.select().from(skillLadder).where(eq((skillLadder as any).skillCode, "TEST.GAMES.1"));
  testSkillId = s.id;

  // Ensure a known game pref exists for break logging
  const existing = await db.select().from(gamePrefs).where(eq(gamePrefs.title, "VITEST GAME"));
  if (existing.length === 0) {
    await db.insert(gamePrefs).values({
      title: "VITEST GAME", kind: "app", emoji: "🎮", preferredMinutes: 5, rank: 9999, active: true,
    } as any);
  }
  const [g] = await db.select().from(gamePrefs).where(eq(gamePrefs.title, "VITEST GAME"));
  testGameId = g.id;
});

afterAll(async () => {
  const db = getDb();
  // Clean rows we created
  await db.delete(moodSignals).where(eq(moodSignals.skillLadderId, testSkillId));
  await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
  await db.delete(proudMoments).where(eq(proudMoments.skillLadderId, testSkillId));
  await db.delete(skillLadder).where(eq(skillLadder.id, testSkillId));
  await db.delete(gameBreakLog).where(eq(gameBreakLog.gamePrefId, testGameId));
  await db.delete(gamePrefs).where(eq(gamePrefs.id, testGameId));
});

async function clearMoodForSkill(id: number) {
  const db = getDb();
  await db.delete(moodSignals).where(eq(moodSignals.skillLadderId, id));
}

describe("games router", () => {
  const caller = appRouter.createCaller(publicCtx());

  it("list returns active game preferences (incl. our test game)", async () => {
    const list: any[] = await caller.games.list({ activeOnly: true });
    expect(Array.isArray(list)).toBe(true);
    expect(list.find((g) => g.title === "VITEST GAME")).toBeTruthy();
  });

  it("2x Hard practice flips suggestBreak true", async () => {
    await clearMoodForSkill(testSkillId);
    await caller.skillLadder.practice({ skillLadderId: testSkillId, mode: "practice", selfRating: 1 });
    await caller.skillLadder.practice({ skillLadderId: testSkillId, mode: "practice", selfRating: 1 });
    const win: any = await caller.games.moodWindow({ windowMin: 30 });
    expect(win.hard).toBeGreaterThanOrEqual(2);
    expect(win.suggestBreak).toBe(true);
  });

  it("2x Got it! with no Hard flips suggestReward true", async () => {
    await clearMoodForSkill(testSkillId);
    await caller.skillLadder.practice({ skillLadderId: testSkillId, mode: "practice", selfRating: 5 });
    await caller.skillLadder.practice({ skillLadderId: testSkillId, mode: "practice", selfRating: 5 });
    const win: any = await caller.games.moodWindow({ windowMin: 30 });
    expect(win.easy).toBeGreaterThanOrEqual(2);
    expect(win.hard).toBe(0);
    expect(win.suggestReward).toBe(true);
  });

  it("logBreak inserts a gameBreakLog row with the chosen reason", async () => {
    await caller.games.logBreak({
      gamePrefId: testGameId,
      reason: "earnedReward",
      durationMinutes: 5,
    });
    const recent: any[] = await caller.games.recentBreaks({ limit: 5 });
    const ours = recent.find((r) => r.gamePrefId === testGameId);
    expect(ours).toBeTruthy();
    expect(ours.reason).toBe("earnedReward");
  });
});
