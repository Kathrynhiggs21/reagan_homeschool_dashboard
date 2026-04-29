import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { skillLadder, skillProgress, weeklyTopics } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * IH curriculum alignment — Phase 4.
 *
 * 1. weeklyTopics.thisWeek returns { weekStart, ihWeekTag, topics } shape
 * 2. nextSkillForToday prefers a skill tagged with the active IH week, even
 *    if a lower-ladder-order untagged skill exists.
 */

function publicCtx(): TrpcContext {
  return {
    user: null as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

let earlyId: number; // ladder-order=1, NOT IH-tagged
let ihId: number;    // ladder-order=999, IH-tagged with the active week

beforeAll(async () => {
  const db = getDb();
  // Insert two test skills in a fresh strand
  await db.insert(skillLadder).values({
    subjectSlug: "math",
    strand: "TEST_IH_ALIGN",
    skillCode: "TEST.IH.ALIGN.EARLY",
    title: "TEST IH ALIGN early skill",
    kidFriendly: "test",
    gradeLevel: "5",
    ladderOrder: 1,
    active: true,
  } as any);
  await db.insert(skillLadder).values({
    subjectSlug: "math",
    strand: "TEST_IH_ALIGN",
    skillCode: "TEST.IH.ALIGN.IH",
    title: "TEST IH ALIGN IH-tagged skill",
    kidFriendly: "test",
    gradeLevel: "5",
    ladderOrder: 999,
    active: true,
  } as any);
  const [a] = await db.select().from(skillLadder).where(eq((skillLadder as any).skillCode, "TEST.IH.ALIGN.EARLY"));
  const [b] = await db.select().from(skillLadder).where(eq((skillLadder as any).skillCode, "TEST.IH.ALIGN.IH"));
  earlyId = a.id;
  ihId = b.id;

  // Tag the IH skill with whatever IH week tag exists for *this* Monday in
  // weeklyTopics. If none, create a temporary weeklyTopics row + tag.
  const today = new Date();
  const day = today.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  const ymd = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,"0")}-${String(monday.getDate()).padStart(2,"0")}`;

  const existingWeek: any[] = await db.select().from(weeklyTopics).where(eq(weeklyTopics.weekStartDate, ymd as any));
  let ihTag: string | null = null;
  for (const r of existingWeek) {
    const m = (r.notes || "").match(/Q\d-W\d+/);
    if (m) { ihTag = m[0]; break; }
  }
  if (!ihTag) {
    await db.insert(weeklyTopics).values({
      weekStartDate: ymd as any,
      subjectSlug: "math",
      topics: ["test topic"] as any,
      notes: "Q9-W99 test alignment",
    } as any);
    ihTag = "Q9-W99";
  }

  // Apply tag to the IH skill
  await db.update(skillLadder).set({ ihWeekTag: ihTag } as any).where(eq(skillLadder.id, ihId));

  // Both skills start at level 0 so both are "next-up eligible"
  await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, earlyId));
  await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, ihId));
});

afterAll(async () => {
  const db = getDb();
  await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, earlyId));
  await db.delete(skillProgress).where(eq(skillProgress.skillLadderId, ihId));
  await db.delete(skillLadder).where(eq(skillLadder.id, earlyId));
  await db.delete(skillLadder).where(eq(skillLadder.id, ihId));
  await db.delete(weeklyTopics).where(eq(weeklyTopics.notes, "Q9-W99 test alignment"));
});

describe("weeklyTopics.thisWeek", () => {
  const caller = appRouter.createCaller(publicCtx());
  it("returns weekStart + topics array shape", async () => {
    const data: any = await caller.weeklyTopics.thisWeek();
    expect(data).toBeTruthy();
    expect(typeof data.weekStart).toBe("string");
    expect(Array.isArray(data.topics)).toBe(true);
  });
});

describe("skillLadder.nextUp prefers IH-tagged skill", () => {
  const caller = appRouter.createCaller(publicCtx());
  it("returns the IH-tagged skill ahead of an untagged earlier-order skill (when IH tag is active)", async () => {
    // Limit to our test strand by filtering math, then verifying among returned skills the IH-tagged one is preferred
    // Use list to confirm both exist with progress=0
    const list: any[] = await caller.skillLadder.list({ subjectSlug: "math" });
    const early = list.find((s) => s.skillCode === "TEST.IH.ALIGN.EARLY");
    const ihTagged = list.find((s) => s.skillCode === "TEST.IH.ALIGN.IH");
    expect(early).toBeTruthy();
    expect(ihTagged).toBeTruthy();
    expect(ihTagged.ihWeekTag).toBeTruthy();

    // nextUp should match IH-tagged ahead of untagged earlier-order
    const nxt: any = await caller.skillLadder.nextUp({ subjectSlug: "math" });
    // It should equal one of the genuinely IH-tagged math skills (could be ours or a real one)
    expect(nxt).toBeTruthy();
    expect(nxt.ihWeekTag).toBeTruthy();
    expect(nxt._matchedIhWeek).toBeTruthy();
  });
});
