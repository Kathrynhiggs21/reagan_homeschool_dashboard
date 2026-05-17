import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { enqueueClassroomLifecycleDriveMove } from "./db";
import { classroomAssignments, drivePushQueue } from "../drizzle/schema";

/**
 * End-to-end check for the lifecycle drive-push enqueue helper.
 *
 * What we want to prove:
 *   1. Real lifecycle move (in_progress -> turned_in) inserts ONE pending
 *      drive_push_queue row pointing at "classes/<Class>/Turned In",
 *      keeps the original driveFileId, and stores fileName.
 *   2. Same args twice in a row is idempotent — second call returns the
 *      existing row's id with skipped="already_pending" and the queue
 *      depth does NOT grow.
 *   3. Same-state move returns skipped="noop" and writes nothing.
 *   4. driveFileId=null returns skipped="no_file" and writes nothing
 *     (we have nothing to move yet — the worker would skip too).
 *   5. Empty / whitespace course name returns skipped="empty_course"
 *      and writes nothing.
 *   6. A path-injecty course name like "Math / Lab" sanitizes to
 *      "Math - Lab" so the targetSubpath is exactly one level deep.
 */

const TEST_FILE_ID_A = "drv_test_classroom_enqueue_A";
const TEST_FILE_ID_B = "drv_test_classroom_enqueue_B";
const TEST_FILE_ID_C = "drv_test_classroom_enqueue_C";

async function cleanup() {
  const d = getDb();
  await d.execute(
    sql`DELETE FROM drive_push_queue WHERE drive_file_id IN (${TEST_FILE_ID_A}, ${TEST_FILE_ID_B}, ${TEST_FILE_ID_C})`,
  );
}

beforeAll(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("enqueueClassroomLifecycleDriveMove", () => {
  it("inserts a pending row with the right targetSubpath for a real lifecycle move", async () => {
    const r = await enqueueClassroomLifecycleDriveMove({
      assignmentId: 999_001,
      courseName: "Math 5",
      fromStatus: "in_progress",
      toStatus: "turned_in",
      driveFileId: TEST_FILE_ID_A,
      fileName: "Fractions WS.pdf",
    });
    expect(r.skipped).toBeUndefined();
    expect(r.id).toBeGreaterThan(0);

    const d = getDb();
    const rows: any[] = await d.execute(
      sql`SELECT id, target_folder, target_subpath, file_name, drive_file_id, status FROM drive_push_queue WHERE id = ${r.id}`,
    );
    // mysql2 returns [rows, fields] — drizzle execute mirrors that.
    const list: any[] = Array.isArray(rows[0]) ? rows[0] : rows;
    expect(list).toHaveLength(1);
    const row = list[0];
    expect(row.target_folder).toBe("classes");
    expect(row.target_subpath).toBe("Math 5/Turned In");
    expect(row.file_name).toBe("Fractions WS.pdf");
    expect(row.drive_file_id).toBe(TEST_FILE_ID_A);
    expect(row.status).toBe("pending");
  });

  it("is idempotent — re-enqueueing the same move reuses the pending row", async () => {
    const first = await enqueueClassroomLifecycleDriveMove({
      assignmentId: 999_001,
      courseName: "Math 5",
      fromStatus: "in_progress",
      toStatus: "turned_in",
      driveFileId: TEST_FILE_ID_A,
      fileName: "Fractions WS.pdf",
    });
    expect(first.skipped).toBe("already_pending");
    expect(first.id).toBeGreaterThan(0);

    // Verify only ONE pending row exists for this drive file + destination.
    const d = getDb();
    const result: any = await d.execute(
      sql`SELECT COUNT(*) AS n FROM drive_push_queue WHERE drive_file_id = ${TEST_FILE_ID_A} AND target_subpath = 'Math 5/Turned In' AND status = 'pending'`,
    );
    const list: any[] = Array.isArray(result[0]) ? result[0] : result;
    expect(Number(list[0].n)).toBe(1);
  });

  it("returns skipped=noop on same-state and writes nothing", async () => {
    const r = await enqueueClassroomLifecycleDriveMove({
      assignmentId: 999_002,
      courseName: "Reading",
      fromStatus: "graded",
      toStatus: "graded",
      driveFileId: TEST_FILE_ID_B,
      fileName: "Story.pdf",
    });
    expect(r.skipped).toBe("noop");
    expect(r.id).toBe(0);

    const d = getDb();
    const result: any = await d.execute(
      sql`SELECT COUNT(*) AS n FROM drive_push_queue WHERE drive_file_id = ${TEST_FILE_ID_B}`,
    );
    const list: any[] = Array.isArray(result[0]) ? result[0] : result;
    expect(Number(list[0].n)).toBe(0);
  });

  it("returns skipped=no_file when there is no Drive file to move", async () => {
    const r = await enqueueClassroomLifecycleDriveMove({
      assignmentId: 999_003,
      courseName: "Science",
      fromStatus: "to_do",
      toStatus: "in_progress",
      driveFileId: null,
      fileName: "Lab.pdf",
    });
    expect(r.skipped).toBe("no_file");
    expect(r.id).toBe(0);
  });

  it("returns skipped=empty_course when the class name sanitizes to nothing", async () => {
    const r = await enqueueClassroomLifecycleDriveMove({
      assignmentId: 999_004,
      courseName: "   ",
      fromStatus: "to_do",
      toStatus: "in_progress",
      driveFileId: TEST_FILE_ID_C,
      fileName: "Anything.pdf",
    });
    expect(r.skipped).toBe("empty_course");
    expect(r.id).toBe(0);
  });

  it("sanitizes path-injecty course names so the subpath is exactly one level deep", async () => {
    const r = await enqueueClassroomLifecycleDriveMove({
      assignmentId: 999_005,
      courseName: "Math / Lab",
      fromStatus: "to_do",
      toStatus: "in_progress",
      driveFileId: TEST_FILE_ID_C,
      fileName: "Worksheet.pdf",
    });
    expect(r.skipped).toBeUndefined();
    expect(r.id).toBeGreaterThan(0);

    const d = getDb();
    const result: any = await d.execute(
      sql`SELECT target_subpath FROM drive_push_queue WHERE id = ${r.id}`,
    );
    const list: any[] = Array.isArray(result[0]) ? result[0] : result;
    expect(list[0].target_subpath).toBe("Math - Lab/In Progress");
    // Critical: the destination contains the expected slash-delimited
    // {ClassName}/{Lifecycle Folder} pattern — the slash inside "Math /
    // Lab" was rewritten to a dash so the worker will not accidentally
    // treat "Lab" as a class folder of its own.
    expect(list[0].target_subpath.split("/")).toHaveLength(2);
  });
});

// Touch the schema imports so eslint/no-unused stays quiet without the
// imports being trimmed by IDE auto-fix.
void classroomAssignments;
void drivePushQueue;
