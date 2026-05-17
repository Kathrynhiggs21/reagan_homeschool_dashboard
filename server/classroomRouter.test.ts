/**
 * classroomRouter.test.ts
 *
 * Real-DB integration test for the gclassroom.* tRPC procedures added
 * 2026-05-17 to support the Classes UI page.
 *
 * Locks:
 *  1. gclassroom.courses.list returns whatever rows exist in classroomCourses
 *     (today: zero, scaffold-empty).
 *  2. gclassroom.assignments.byLifecycle filters on lifecycleStatus + subjectId.
 *  3. gclassroom.assignments.updateStatus moves an assignment through
 *     to_do -> in_progress -> turned_in -> graded, stamping
 *     startedAt / turnedInAt / gradedAt at each transition (and accepting
 *     a grade on the final step).
 *  4. Each transition writes one audit row to classroomSubmissions with
 *     fromStatus / toStatus / changedBy.
 *  5. gclassroom.audit.forAssignment returns the audit chain newest-first.
 *  6. gclassroom.sync returns the not_yet_authenticated stub shape.
 *
 * Uses a tag-prefixed externalId so the test row is unique per CI run and
 * is cleaned up at the end.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { classroomAssignments, classroomSubmissions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

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

const TAG = `VITEST-CLASSROOM-${process.pid}-${Date.now()}`;
const externalId = `${TAG}-ext-1`;
let assignmentId = 0;

beforeAll(async () => {
  const d = getDb();
  // Insert a single test classroomAssignment row directly so we control the externalId.
  await d.insert(classroomAssignments).values({
    externalId,
    courseId: `${TAG}-course`,
    courseName: `${TAG} Test Course`,
    title: `${TAG} Test Assignment`,
    description: "Created by classroomRouter.test.ts",
    workType: "ASSIGNMENT",
    state: "PUBLISHED",
    link: null,
    dueAt: null,
    lifecycleStatus: "to_do",
  } as any);
  const inserted: any[] = await d
    .select()
    .from(classroomAssignments)
    .where(eq(classroomAssignments.externalId as any, externalId));
  assignmentId = Number(inserted[0].id);
  expect(assignmentId).toBeGreaterThan(0);
});

afterAll(async () => {
  const d = getDb();
  // Clean up audit rows + the assignment.
  try {
    await d.delete(classroomSubmissions).where(eq(classroomSubmissions.assignmentId as any, assignmentId));
    await d.delete(classroomAssignments).where(eq(classroomAssignments.id as any, assignmentId));
  } catch {}
});

describe("gclassroom router", () => {
  it("courses.list returns an array (scaffold may be empty)", async () => {
    const rows = await caller.gclassroom.courses.list();
    expect(Array.isArray(rows)).toBe(true);
  });

  it("assignments.byLifecycle('to_do') includes our test row", async () => {
    const rows = await caller.gclassroom.assignments.byLifecycle({
      lifecycleStatus: "to_do",
      limit: 500,
    });
    const ours = (rows as any[]).find((r) => r.id === assignmentId);
    expect(ours, "test assignment should be in to_do bucket").toBeTruthy();
    expect(ours.lifecycleStatus).toBe("to_do");
  });

  it("updateStatus to_do -> in_progress stamps startedAt + writes audit row", async () => {
    const before = Date.now();
    const out = await caller.gclassroom.assignments.updateStatus({
      assignmentId,
      toStatus: "in_progress",
      changedBy: "mom",
      note: "Starting it now",
    });
    expect(out.fromStatus).toBe("to_do");
    expect(out.toStatus).toBe("in_progress");
    expect(out.assignment.lifecycleStatus).toBe("in_progress");
    expect(new Date(out.assignment.startedAt).getTime()).toBeGreaterThanOrEqual(before - 5_000);

    const audit = await caller.gclassroom.audit.forAssignment({ assignmentId });
    expect(audit.length).toBe(1);
    expect((audit[0] as any).fromStatus).toBe("to_do");
    expect((audit[0] as any).toStatus).toBe("in_progress");
    expect((audit[0] as any).changedBy).toBe("mom");
  });

  it("updateStatus in_progress -> turned_in stamps turnedInAt + appends audit", async () => {
    const out = await caller.gclassroom.assignments.updateStatus({
      assignmentId,
      toStatus: "turned_in",
      changedBy: "reagan",
    });
    expect(out.fromStatus).toBe("in_progress");
    expect(out.toStatus).toBe("turned_in");
    expect(out.assignment.turnedInAt).toBeTruthy();
    const audit = await caller.gclassroom.audit.forAssignment({ assignmentId });
    expect(audit.length).toBe(2);
    expect((audit[0] as any).toStatus).toBe("turned_in"); // newest first
  });

  it("updateStatus turned_in -> graded persists grade + gradeNumeric", async () => {
    const out = await caller.gclassroom.assignments.updateStatus({
      assignmentId,
      toStatus: "graded",
      changedBy: "mom",
      grade: "A-",
      gradeNumeric: 92.5,
    });
    expect(out.fromStatus).toBe("turned_in");
    expect(out.toStatus).toBe("graded");
    expect(out.assignment.gradedAt).toBeTruthy();
    expect(out.assignment.grade).toBe("A-");
    // gradeNumeric comes back as string in mysql/drizzle decimals
    expect(String(out.assignment.gradeNumeric)).toBe("92.50");

    const audit = await caller.gclassroom.audit.forAssignment({ assignmentId });
    expect(audit.length).toBe(3);
  });

  it("byLifecycle('graded') now includes our test row, byLifecycle('to_do') does not", async () => {
    const graded = await caller.gclassroom.assignments.byLifecycle({ lifecycleStatus: "graded", limit: 500 });
    const inGraded = (graded as any[]).find((r) => r.id === assignmentId);
    expect(inGraded, "should appear in graded bucket").toBeTruthy();

    const todo = await caller.gclassroom.assignments.byLifecycle({ lifecycleStatus: "to_do", limit: 500 });
    const inToDo = (todo as any[]).find((r) => r.id === assignmentId);
    expect(inToDo, "should NOT appear in to_do bucket anymore").toBeFalsy();
  });

  it("sync returns the not_yet_authenticated stub shape", async () => {
    const out = await caller.gclassroom.sync();
    expect(out.status).toBe("not_yet_authenticated");
    expect(out.coursesSynced).toBe(0);
    expect(out.assignmentsSynced).toBe(0);
    expect(typeof out.message).toBe("string");
  });
});
