/**
 * academics.bulkUpsert dedupes by (schoolYear + course/subject + term + title).
 * Re-running the same import is safe and idempotent.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { academicRecords } from "../drizzle/schema";
import { inArray } from "drizzle-orm";
import { academicRecordKey } from "./db";

const ownerOpenId = process.env.OWNER_OPEN_ID || "manus-ci";
const ctx = { user: { openId: ownerOpenId, role: "owner" as const, name: "ci" } };
const caller = appRouter.createCaller(ctx as any);

const tag = `VITEST-BULK-${process.pid}-${Date.now()}`;
const ids: number[] = [];

describe("academics.bulkUpsert", () => {
  afterAll(async () => {
    if (ids.length) await getDb().delete(academicRecords).where(inArray(academicRecords.id, ids));
  });

  it("inserts new rows and skips dupes", async () => {
    const rows = [
      { source: "manual", kind: "grade", title: `${tag} HW1`, subjectSlug: "math",
        scoreText: "A", scorePercent: 95, schoolYear: "2024-25", term: "Q1",
        courseName: "Math 4" } as any,
      { source: "manual", kind: "grade", title: `${tag} HW2`, subjectSlug: "math",
        scoreText: "B", scorePercent: 85, schoolYear: "2024-25", term: "Q1",
        courseName: "Math 4" } as any,
    ];
    const first = await caller.academics.bulkUpsert({ records: rows });
    expect(first.inserted).toBe(2);
    expect(first.skipped).toBe(0);
    ids.push(...first.insertedIds);

    // Re-run: everything should be skipped.
    const second = await caller.academics.bulkUpsert({ records: rows });
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(2);
  });

  it("treats different terms as distinct", async () => {
    const rows = [
      { source: "manual", kind: "grade", title: `${tag} TermSplit`, subjectSlug: "math",
        scoreText: "A", schoolYear: "2024-25", term: "Q2", courseName: "Math 4" } as any,
      { source: "manual", kind: "grade", title: `${tag} TermSplit`, subjectSlug: "math",
        scoreText: "A", schoolYear: "2024-25", term: "Q3", courseName: "Math 4" } as any,
    ];
    const r = await caller.academics.bulkUpsert({ records: rows });
    expect(r.inserted).toBe(2);
    ids.push(...r.insertedIds);
  });

  it("academicRecordKey is case + whitespace insensitive", () => {
    const k1 = academicRecordKey({ schoolYear: " 2024-25 ", courseName: "Math 4", term: "Q1", title: "HW 1" });
    const k2 = academicRecordKey({ schoolYear: "2024-25", courseName: "math 4", term: "q1", title: "  HW 1  " });
    expect(k1).toBe(k2);
  });
});
