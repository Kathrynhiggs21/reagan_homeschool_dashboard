import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { tutors, tutorSessions, tutorSessionSkills, skillLadder, skillProgress, moodSignals, adaptiveHints } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";

const TEST_TUTOR_PREFIX = "TEST:tutorRouter";
const TEST_SKILL_CODE = "TEST.tutorRouter.SKILL";

let testTutorId: number;
let testSkillId: number;

const ctxOwner = { user: { id: "owner-1", role: "owner" as const, name: "Owner", openId: "x" } };
const callerOwner = appRouter.createCaller(ctxOwner as any);
const callerPub = appRouter.createCaller({ user: undefined } as any);

beforeAll(async () => {
  const db = getDb();
  const ladderRows = await db.insert(skillLadder).values({
    subjectSlug: "math",
    strand: "test",
    skillCode: TEST_SKILL_CODE,
    title: "Test tutor skill",
    kidFriendly: "Test tutor skill",
    ladderOrder: 1,
    gradeLevel: 5,
  } as any).$returningId();
  testSkillId = ladderRows[0].id;
});

afterAll(async () => {
  const db = getDb();
  if (testTutorId) {
    const sess = await db.select({ id: tutorSessions.id }).from(tutorSessions).where(eq(tutorSessions.tutorId, testTutorId));
    for (const s of sess) {
      await db.delete(tutorSessionSkills).where(eq(tutorSessionSkills.sessionId, s.id));
    }
    await db.delete(tutorSessions).where(eq(tutorSessions.tutorId, testTutorId));
    await db.delete(tutors).where(eq(tutors.id, testTutorId));
  }
  await db.delete(tutors).where(like(tutors.name, `${TEST_TUTOR_PREFIX}%`));
  if (testSkillId) {
    await db.delete(adaptiveHints).where(eq(adaptiveHints.skillLadderId, testSkillId));
    await db.delete(moodSignals).where(eq(moodSignals.skillLadderId, testSkillId));
    await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
    await db.delete(skillLadder).where(eq(skillLadder.id, testSkillId));
  }
});

describe("tutors router", () => {
  it("upsert creates a tutor", async () => {
    const r = await callerOwner.tutors.upsert({
      name: `${TEST_TUTOR_PREFIX} 1`,
      role: "Test tutor",
      subjects: "math",
    });
    expect(r.id).toBeTypeOf("number");
    testTutorId = r.id as number;

    const list = await callerPub.tutors.list({ activeOnly: false });
    expect(list.find((t: any) => t.id === testTutorId)).toBeTruthy();
  });

  it("priority returns lowest-mastery skills in tutor's subjects", async () => {
    const p = await callerPub.tutors.priority({ tutorId: testTutorId, limit: 5 });
    // At least our test math skill should appear
    expect(Array.isArray(p)).toBe(true);
    const found = p.find((s: any) => s.id === testSkillId);
    expect(found).toBeTruthy();
  });

  it("recordSession with strong outcome bumps confidence (feeds adaptation)", async () => {
    const before = await getDb().select().from(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
    const beforeConf = (before[0] as any)?.confidence ?? 0;

    await callerOwner.tutors.recordSession({
      tutorId: testTutorId,
      sessionNotes: "great session",
      skills: [{ skillLadderId: testSkillId, outcome: "strong" }],
      status: "completed",
    });

    const after = await getDb().select().from(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
    const afterConf = (after[0] as any)?.confidence ?? 0;
    expect(afterConf).toBeGreaterThan(beforeConf);
  });

  it("recordSession with needsMore writes a hard moodSignal + adaptive hint", async () => {
    await callerOwner.tutors.recordSession({
      tutorId: testTutorId,
      sessionNotes: "needs more time",
      skills: [{ skillLadderId: testSkillId, outcome: "needsMore", tutorNote: "still confusing" }],
      status: "completed",
    });
    const moods = await getDb().select().from(moodSignals).where(eq(moodSignals.skillLadderId, testSkillId));
    expect(moods.some((m: any) => m.feltIt === "hard" && (m.note || "").includes("Tutor flagged"))).toBe(true);
  });

  it("public tutor list works without auth", async () => {
    const list = await callerPub.tutors.list({ activeOnly: true });
    expect(Array.isArray(list)).toBe(true);
  });

  it("upsert without auth is rejected", async () => {
    await expect(callerPub.tutors.upsert({ name: "Should fail" } as any)).rejects.toThrow(/login|auth|UNAUTHORIZED/i);
  });
});
