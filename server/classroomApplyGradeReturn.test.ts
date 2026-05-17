/**
 * classroomApplyGradeReturn.test.ts
 *
 * Real-DB integration test for the new
 * `gclassroom.assignments.applyGradeReturn` mutation.
 *
 * Locks the wiring contract:
 *  1. returnedAt=null         -> { skipped: "not_returned_yet" }, no DB write.
 *  2. First-time return        -> flips lifecycle to "graded", stamps grade
 *                                 + gradeNumeric, writes audit row, and
 *                                 enqueues a Drive lifecycle move ONLY when
 *                                 the assignment has a driveFolderId.
 *  3. Same-grade re-fire       -> { skipped: "already_applied" } (idempotent).
 *  4. Different-grade re-fire  -> writes a new graded audit row.
 *
 * Inserts uniquely tagged synthetic rows so this test is safe to run
 * concurrently and cleans them up at the end.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import {
  classroomAssignments,
  classroomSubmissions,
  drivePushQueue,
} from "../drizzle/schema";
import { sql, eq, and, desc } from "drizzle-orm";

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

const TAG = `VITEST-CLASSROOM-AGR-${process.pid}-${Date.now()}`;

let assignmentNoDrive = 0;
let assignmentWithDrive = 0;

beforeAll(async () => {
  const d = getDb();
  // Row 1: turned_in, no driveFolderId — exercises null Drive path.
  await d.insert(classroomAssignments).values({
    externalId: `${TAG}-noDrive`,
    courseId: `${TAG}-c`,
    courseName: `${TAG} Course`,
    title: `${TAG} no-drive`,
    workType: "ASSIGNMENT",
    state: "PUBLISHED",
    lifecycleStatus: "turned_in",
  } as any);
  // Row 2: turned_in WITH driveFolderId so enqueue actually writes.
  await d.insert(classroomAssignments).values({
    externalId: `${TAG}-withDrive`,
    courseId: `${TAG}-c`,
    courseName: `${TAG} Course`,
    title: `${TAG} with-drive`,
    workType: "ASSIGNMENT",
    state: "PUBLISHED",
    lifecycleStatus: "turned_in",
    driveFolderId: `${TAG}-fileid`,
  } as any);

  const rows: any[] = await d
    .select()
    .from(classroomAssignments)
    .where(sql`${classroomAssignments.externalId} LIKE ${TAG + "%"}`);
  for (const r of rows) {
    if (r.externalId === `${TAG}-noDrive`) assignmentNoDrive = r.id;
    if (r.externalId === `${TAG}-withDrive`) assignmentWithDrive = r.id;
  }
});

afterAll(async () => {
  const d = getDb();
  try {
    // Clean up audit + queue + assignments tied to this fixture.
    if (assignmentNoDrive)
      await d
        .delete(classroomSubmissions)
        .where(eq(classroomSubmissions.assignmentId as any, assignmentNoDrive));
    if (assignmentWithDrive)
      await d
        .delete(classroomSubmissions)
        .where(eq(classroomSubmissions.assignmentId as any, assignmentWithDrive));
    await d.execute(sql`DELETE FROM drive_push_queue WHERE drive_file_id = ${TAG + "-fileid"}`);
    await d
      .delete(classroomAssignments)
      .where(sql`${classroomAssignments.externalId} LIKE ${TAG + "%"}`);
  } catch {}
});

describe("gclassroom.assignments.applyGradeReturn", () => {
  it("returnedAt=null is a no-op", async () => {
    const out = await caller.gclassroom.assignments.applyGradeReturn({
      assignmentId: assignmentNoDrive,
      returnedAt: null,
      grade: "A-",
      assignedGrade: 92,
      maxPoints: 100,
      changedBy: "classroom_sync",
    });
    expect(out).toEqual({ skipped: "not_returned_yet" });

    const d = getDb();
    const row: any[] = await d
      .select()
      .from(classroomAssignments)
      .where(eq(classroomAssignments.id as any, assignmentNoDrive));
    expect(row[0].lifecycleStatus).toBe("turned_in"); // unchanged
  });

  it("first-time return flips to graded + writes grade fields + writes audit row", async () => {
    const ts = new Date("2026-05-15T16:00:00Z");
    const out: any = await caller.gclassroom.assignments.applyGradeReturn({
      assignmentId: assignmentNoDrive,
      returnedAt: ts,
      grade: "A-",
      assignedGrade: 92,
      maxPoints: 100,
      changedBy: "classroom_sync",
    });
    expect(out.applied).toBe(true);
    expect(out.toStatus).toBe("graded");

    const d = getDb();
    const row: any[] = await d
      .select()
      .from(classroomAssignments)
      .where(eq(classroomAssignments.id as any, assignmentNoDrive));
    expect(row[0].lifecycleStatus).toBe("graded");
    expect(row[0].grade).toBe("A-");
    // gradeNumeric is decimal-as-string in MySQL/drizzle:
    expect(String(row[0].gradeNumeric)).toMatch(/^92(\.0+)?$/);

    const audit: any[] = await d
      .select()
      .from(classroomSubmissions)
      .where(eq(classroomSubmissions.assignmentId as any, assignmentNoDrive))
      .orderBy(desc(classroomSubmissions.id as any))
      .limit(1);
    expect(audit.length).toBe(1);
    expect(audit[0].toStatus).toBe("graded");
    expect(String(audit[0].note ?? "")).toContain("Classroom returned");
  });

  it("same-grade re-fire on already-graded row is idempotent", async () => {
    const ts = new Date("2026-05-15T16:00:00Z");
    const out = await caller.gclassroom.assignments.applyGradeReturn({
      assignmentId: assignmentNoDrive,
      returnedAt: ts,
      grade: "A-",
      assignedGrade: 92,
      maxPoints: 100,
      changedBy: "classroom_sync",
    });
    expect(out).toEqual({ skipped: "already_applied" });
  });

  it("different grade after a flip writes a fresh audit row + updates fields", async () => {
    const ts = new Date("2026-05-16T16:00:00Z");
    const out: any = await caller.gclassroom.assignments.applyGradeReturn({
      assignmentId: assignmentNoDrive,
      returnedAt: ts,
      grade: "A",
      assignedGrade: 95,
      maxPoints: 100,
      changedBy: "classroom_sync",
    });
    expect(out.applied).toBe(true);

    const d = getDb();
    const row: any[] = await d
      .select()
      .from(classroomAssignments)
      .where(eq(classroomAssignments.id as any, assignmentNoDrive));
    expect(row[0].grade).toBe("A");
    expect(String(row[0].gradeNumeric)).toMatch(/^95(\.0+)?$/);

    const audit: any[] = await d
      .select()
      .from(classroomSubmissions)
      .where(eq(classroomSubmissions.assignmentId as any, assignmentNoDrive));
    // Should now have at least 2 audit rows for this assignment.
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });

  it("with driveFolderId set, applyGradeReturn enqueues exactly one drive_push_queue row", async () => {
    const d = getDb();
    // We tag rows by their driveFileId, which the helper carries
    // through unchanged. That gives us a stable per-assignment lookup.
    const driveFileId = `${TAG}-fileid`;
    const before: any[] = await d
      .select()
      .from(drivePushQueue)
      .where(
        and(
          eq(drivePushQueue.targetFolder as any, "classes" as any),
          eq(drivePushQueue.driveFileId as any, driveFileId as any),
        ) as any,
      );

    const ts = new Date("2026-05-15T16:00:00Z");
    const out: any = await caller.gclassroom.assignments.applyGradeReturn({
      assignmentId: assignmentWithDrive,
      returnedAt: ts,
      grade: "Pass",
      assignedGrade: null,
      maxPoints: null,
      changedBy: "classroom_sync",
    });
    expect(out.applied).toBe(true);
    expect(out.driveQueue?.skipped).toBeUndefined(); // not skipped

    const after: any[] = await d
      .select()
      .from(drivePushQueue)
      .where(
        and(
          eq(drivePushQueue.targetFolder as any, "classes" as any),
          eq(drivePushQueue.driveFileId as any, driveFileId as any),
        ) as any,
      );
    expect(after.length).toBe(before.length + 1);
    // The new row should target the graded subfolder under the
    // sanitized course name.
    const newest = after[after.length - 1];
    expect(String(newest.targetSubpath)).toMatch(/\/Graded$/);
  });
});
