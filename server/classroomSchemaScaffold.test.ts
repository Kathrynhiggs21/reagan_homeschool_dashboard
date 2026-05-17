/**
 * classroomSchemaScaffold.test.ts
 *
 * Locks the Classroom REST integration schema scaffold:
 *  - classroomCourses table exists with required columns
 *  - classroomAssignments has lifecycle + subject + grade + drive folder columns
 *  - classroomSubmissions audit log table exists
 *  - All four lifecycle states (to_do, in_progress, turned_in, graded) accepted
 *  - lifecycleStatus defaults to 'to_do' on insert
 *
 * The scaffold is empty-but-ready: no rows expected. Once Mom grants OAuth scope
 * and the sync runs, courses + assignments will populate. This test validates the
 * rails are in place.
 *
 * Note: drizzle-orm/mysql2 returns the raw mysql2 tuple [rows, fields] from
 * db.execute(sql`...`), so we always extract result[0] for the row array.
 */

import { describe, expect, it } from "vitest";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

type ColumnRow = {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
};

async function showColumns(table: string): Promise<ColumnRow[]> {
  const db = getDb();
  const raw = (await db.execute(sql.raw(`SHOW COLUMNS FROM ${table}`))) as unknown as [ColumnRow[], unknown];
  return raw[0];
}

async function rowCount(table: string): Promise<number> {
  const db = getDb();
  const raw = (await db.execute(sql.raw(`SELECT COUNT(*) AS c FROM ${table}`))) as unknown as [Array<{ c: number | string }>, unknown];
  return Number(raw[0][0].c);
}

describe("classroom integration schema scaffold", () => {
  it("classroomCourses table exists with all required columns", async () => {
    const cols = (await showColumns("classroomCourses")).map((r) => r.Field);
    for (const required of [
      "id", "externalId", "name", "section", "description", "room",
      "ownerName", "enrollmentCode", "courseState", "alternateLink",
      "subjectId", "syncedAt", "createdAt", "updatedAt",
    ]) {
      expect(cols, `missing column: ${required}`).toContain(required);
    }
  });

  it("classroomAssignments has lifecycle + subject + grade columns", async () => {
    const rows = await showColumns("classroomAssignments");
    const colMap = new Map(rows.map((r) => [r.Field, r]));

    for (const required of [
      "lifecycleStatus", "subjectId", "startedAt", "turnedInAt",
      "gradedAt", "grade", "gradeNumeric", "driveFolderId",
    ]) {
      expect(colMap.has(required), `missing column: ${required}`).toBe(true);
    }

    // lifecycleStatus must default to 'to_do' and accept all four states
    const lifecycle = colMap.get("lifecycleStatus")!;
    expect(lifecycle.Default).toBe("to_do");
    expect(lifecycle.Type).toContain("to_do");
    expect(lifecycle.Type).toContain("in_progress");
    expect(lifecycle.Type).toContain("turned_in");
    expect(lifecycle.Type).toContain("graded");
  });

  it("classroomSubmissions audit log table exists", async () => {
    const cols = (await showColumns("classroomSubmissions")).map((r) => r.Field);
    for (const required of [
      "id", "assignmentId", "fromStatus", "toStatus",
      "changedBy", "note", "driveFileId", "createdAt",
    ]) {
      expect(cols, `missing column: ${required}`).toContain(required);
    }
  });

  it("scaffold is empty-but-ready (no rows yet)", async () => {
    expect(await rowCount("classroomCourses")).toBe(0);
    expect(await rowCount("classroomSubmissions")).toBe(0);
  });
});
