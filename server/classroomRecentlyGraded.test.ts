/**
 * classroomRecentlyGraded.test.ts
 *
 * Real-DB integration test for the new `gclassroom.assignments.recentlyGraded`
 * procedure + its underlying db helper.
 *
 * Locks the contract Mom's adult dashboard depends on:
 *  - Returns only lifecycleStatus='graded' rows.
 *  - Ordered by gradedAt DESC (with COALESCE to updatedAt as a fallback so
 *    legacy rows without gradedAt still sort somewhere reasonable),
 *    then id DESC as tiebreaker.
 *  - Honors the limit input (default 20, clamped 1..100).
 *  - Pre-applyGradeReturn fixture state -> result excludes our test rows
 *    that haven't been flipped to graded.
 *
 * Tags inserted rows so it's safe to run alongside other tests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb, listClassroomAssignmentsRecentlyGraded } from "./db";
import { classroomAssignments } from "../drizzle/schema";
import { sql } from "drizzle-orm";

const ctx = {
  user: {
    openId: process.env.OWNER_OPEN_ID || "manus-ci",
    role: "admin" as const,
    name: "ci",
    id: 1,
    email: "spear.cpt@gmail.com",
  },
};
const caller = appRouter.createCaller(ctx as any);

const TAG = `VITEST-CLASSROOM-RG-${process.pid}-${Date.now()}`;
const insertedIds: number[] = [];

beforeAll(async () => {
  const d = getDb();
  // Seed: 3 graded rows with explicit gradedAt timestamps spaced apart,
  // 1 turned_in row that should be excluded.
  const gradedAt0 = new Date("2026-05-10T12:00:00Z");
  const gradedAt1 = new Date("2026-05-12T12:00:00Z");
  const gradedAt2 = new Date("2026-05-14T12:00:00Z");
  await d.insert(classroomAssignments).values([
    {
      externalId: `${TAG}-g0`,
      courseId: `${TAG}-c`,
      courseName: `${TAG} Course`,
      title: `${TAG} Old graded`,
      workType: "ASSIGNMENT",
      state: "PUBLISHED",
      lifecycleStatus: "graded",
      grade: "B",
      gradeNumeric: "85.00" as any,
      gradedAt: gradedAt0,
    } as any,
    {
      externalId: `${TAG}-g1`,
      courseId: `${TAG}-c`,
      courseName: `${TAG} Course`,
      title: `${TAG} Mid graded`,
      workType: "ASSIGNMENT",
      state: "PUBLISHED",
      lifecycleStatus: "graded",
      grade: "A-",
      gradeNumeric: "92.00" as any,
      gradedAt: gradedAt1,
    } as any,
    {
      externalId: `${TAG}-g2`,
      courseId: `${TAG}-c`,
      courseName: `${TAG} Course`,
      title: `${TAG} Newest graded`,
      workType: "ASSIGNMENT",
      state: "PUBLISHED",
      lifecycleStatus: "graded",
      grade: "A",
      gradeNumeric: "95.00" as any,
      gradedAt: gradedAt2,
    } as any,
    {
      externalId: `${TAG}-ti`,
      courseId: `${TAG}-c`,
      courseName: `${TAG} Course`,
      title: `${TAG} Still turned-in`,
      workType: "ASSIGNMENT",
      state: "PUBLISHED",
      lifecycleStatus: "turned_in",
    } as any,
  ]);

  const rows: any[] = await d
    .select()
    .from(classroomAssignments)
    .where(sql`${classroomAssignments.externalId} LIKE ${TAG + "%"}`);
  for (const r of rows) insertedIds.push(r.id);
});

afterAll(async () => {
  const d = getDb();
  try {
    await d
      .delete(classroomAssignments)
      .where(sql`${classroomAssignments.externalId} LIKE ${TAG + "%"}`);
  } catch {}
});

describe("classroom recentlyGraded", () => {
  it("db helper: returns only graded rows ordered newest gradedAt first", async () => {
    const rows = await listClassroomAssignmentsRecentlyGraded({ limit: 50 });
    // Filter to only our tagged rows so this test is concurrency-safe.
    const ours = rows.filter((r: any) =>
      String(r.externalId ?? "").startsWith(TAG),
    );
    expect(ours.length).toBe(3); // turned_in row excluded
    // First three should be newest -> oldest by gradedAt.
    expect(ours[0].externalId).toBe(`${TAG}-g2`);
    expect(ours[1].externalId).toBe(`${TAG}-g1`);
    expect(ours[2].externalId).toBe(`${TAG}-g0`);
  });

  it("db helper: limit clamps + applies", async () => {
    const onlyOne = await listClassroomAssignmentsRecentlyGraded({ limit: 1 });
    expect(onlyOne.length).toBe(1);
    // Even with absurd limits, helper should clamp to <=100, never throw.
    const big = await listClassroomAssignmentsRecentlyGraded({ limit: 9999 });
    expect(big.length).toBeLessThanOrEqual(100);
  });

  it("tRPC: gclassroom.assignments.recentlyGraded returns the same shape as the helper", async () => {
    const out: any[] = await caller.gclassroom.assignments.recentlyGraded({
      limit: 50,
    });
    const ours = out.filter((r) =>
      String(r.externalId ?? "").startsWith(TAG),
    );
    expect(ours.length).toBe(3);
    expect(ours[0].lifecycleStatus).toBe("graded");
    expect(ours[0].grade).toBeDefined();
  });

  it("tRPC: default input (no input arg) works", async () => {
    const out: any[] = await caller.gclassroom.assignments.recentlyGraded();
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBeLessThanOrEqual(20);
  });
});
