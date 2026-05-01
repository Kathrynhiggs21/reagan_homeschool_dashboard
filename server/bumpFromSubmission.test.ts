import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import * as db from "./db";
import { skillLadder, skillProgress } from "../drizzle/schema";

/**
 * Phase 5: every turn-in nudges the curriculum tree + skill ladder.
 * - bumpFromSubmission flips a matching curriculumTopics row to inProgress
 * - bumpFromSubmission records one practice round on the lowest-level active
 *   skill in the subject, with selfRating derived from kid difficulty.
 */

const TEST_TITLE = "__vitest-bump-skill";
const TEST_STRAND = "__vitest-bump-strand";

describe("bumpFromSubmission (Phase 5)", () => {
  let testSkillId: number | null = null;
  let testTopicId: number | null = null;
  let uniq = "";

  beforeAll(async () => {
    await db.ensureCurriculumSeeded();
    const drizzle = (db as any).getDb?.() ?? null;
    // Seed a math skill we know is at level 0 so practice will increment it
    // Use a unique code per worker so parallel test files can't collide,
    // and pin ladderOrder=0 so bumpFromSubmission's "lowest active" pick
    // deterministically lands on us instead of any other parallel fixture.
    uniq = `VITEST-BUMP-${process.pid}-${Date.now()}`;
    await drizzle.insert(skillLadder).values({
      subjectSlug: "math",
      strand: TEST_STRAND,
      skillCode: uniq,
      title: TEST_TITLE,
      kidFriendly: "Vitest skill",
      ladderOrder: 0,
      active: true,
    });
    const [latest] = await drizzle.select().from(skillLadder).where(eq(skillLadder.skillCode, uniq)).limit(1);
    testSkillId = latest?.id ?? null;
    // Insert a synthetic curriculumTopics row we can match by code substring
    await drizzle.execute(sql`
      INSERT INTO curriculumTopics (subject, code, title, standard_ref, ord, status, quarter)
      VALUES ('Math', 'BUMP-CODE', 'Vitest fake topic for bump', null, 99999, 'notStarted', 'Q4')
    `);
    const [tRow]: any = await drizzle.execute(sql`SELECT id FROM curriculumTopics WHERE code = 'BUMP-CODE' LIMIT 1`);
    testTopicId = (tRow as any[])[0]?.id ?? null;
  });

  afterAll(async () => {
    const drizzle = (db as any).getDb?.() ?? null;
    if (testSkillId) {
      await drizzle.delete(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId));
      await drizzle.delete(skillLadder).where(eq(skillLadder.id, testSkillId));
    }
    await drizzle.execute(sql`DELETE FROM curriculumTopics WHERE code = 'BUMP-CODE'`);
  });

  it("marks a matching curriculum topic as inProgress when block title contains its code", async () => {
    const r = await db.bumpFromSubmission({
      subjectSlug: "math",
      blockTitle: "Practice on BUMP-CODE worksheet",
      kidDifficulty: "just_right",
    });
    expect(r.topicId).toBe(testTopicId);
    const drizzle = (db as any).getDb?.() ?? null;
    const [check]: any = await drizzle.execute(sql`SELECT status FROM curriculumTopics WHERE id = ${testTopicId}`);
    expect((check as any[])[0].status).toBe("inProgress");
  });

  it("records a practice round on a math skill with rating derived from difficulty", async () => {
    const r = await db.bumpFromSubmission({
      subjectSlug: "math",
      blockTitle: "Some math activity",
      kidDifficulty: "easy",
    });
    expect(r.skillLadderId).toBeTruthy();
    // It should be OUR fixture skill (pinned at ladderOrder=0).
    expect(r.skillLadderId).toBe(testSkillId);
    // Read evidence on our specific skill id (no risk of parallel cleanup).
    const drizzle = (db as any).getDb?.() ?? null;
    const [progress] = await drizzle.select().from(skillProgress).where(eq(skillProgress.skillLadderId, testSkillId!));
    expect(progress).toBeTruthy();
    expect(progress.evidenceCount).toBeGreaterThanOrEqual(1);
  });

  it("is a no-op when subjectSlug is missing", async () => {
    const r = await db.bumpFromSubmission({
      subjectSlug: null,
      blockTitle: "Untyped block",
      kidDifficulty: "tricky",
    });
    expect(r.topicId).toBeNull();
    expect(r.skillLadderId).toBeNull();
  });
});
