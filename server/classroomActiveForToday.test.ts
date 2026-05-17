/**
 * classroomActiveForToday.test.ts
 *
 * Real-DB integration test for the new
 * `gclassroom.assignments.activeForToday` query (and its underlying
 * `db.listClassroomAssignmentsActiveForToday` helper).
 *
 * Locks the contract Reagan's Today page depends on:
 *  1. lifecycle in (to_do, in_progress) only — turned_in/graded must be
 *     filtered out so the Today card never shows finished work.
 *  2. due IS NULL is included (open-ended assignments).
 *  3. due within `windowDays` is included; due past `windowDays` is excluded.
 *  4. due in the past is excluded (we only show "what to do now/soon").
 *  5. The result is ordered by dueAt ascending.
 *
 * Inserts 6 synthetic rows tagged with this test's pid+timestamp so the
 * fixture is unique per CI run, then cleans them all up at the end.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
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

const TAG = `VITEST-CLASSROOM-ACTIVE-${process.pid}-${Date.now()}`;
const ids: { label: string; externalId: string }[] = [
  { label: "todo_no_due",    externalId: `${TAG}-1` },
  { label: "todo_in_window", externalId: `${TAG}-2` },
  { label: "ip_in_window",   externalId: `${TAG}-3` },
  { label: "todo_past_due",  externalId: `${TAG}-4` },
  { label: "todo_far_future",externalId: `${TAG}-5` },
  { label: "graded_in_window",externalId: `${TAG}-6` },
];

const now = new Date();
const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
const inFortyDays = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);
const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  const d = getDb();
  await d.insert(classroomAssignments).values([
    {
      externalId: ids[0].externalId,
      courseId: `${TAG}-c`, courseName: `${TAG} C`, title: `${TAG} todo no due`,
      workType: "ASSIGNMENT", state: "PUBLISHED",
      lifecycleStatus: "to_do",
      dueAt: null,
    },
    {
      externalId: ids[1].externalId,
      courseId: `${TAG}-c`, courseName: `${TAG} C`, title: `${TAG} todo +3d`,
      workType: "ASSIGNMENT", state: "PUBLISHED",
      lifecycleStatus: "to_do",
      dueAt: inThreeDays,
    },
    {
      externalId: ids[2].externalId,
      courseId: `${TAG}-c`, courseName: `${TAG} C`, title: `${TAG} ip +3d`,
      workType: "ASSIGNMENT", state: "PUBLISHED",
      lifecycleStatus: "in_progress",
      dueAt: inThreeDays,
    },
    {
      externalId: ids[3].externalId,
      courseId: `${TAG}-c`, courseName: `${TAG} C`, title: `${TAG} todo -5d`,
      workType: "ASSIGNMENT", state: "PUBLISHED",
      lifecycleStatus: "to_do",
      dueAt: fiveDaysAgo,
    },
    {
      externalId: ids[4].externalId,
      courseId: `${TAG}-c`, courseName: `${TAG} C`, title: `${TAG} todo +40d`,
      workType: "ASSIGNMENT", state: "PUBLISHED",
      lifecycleStatus: "to_do",
      dueAt: inFortyDays,
    },
    {
      externalId: ids[5].externalId,
      courseId: `${TAG}-c`, courseName: `${TAG} C`, title: `${TAG} graded +3d`,
      workType: "ASSIGNMENT", state: "PUBLISHED",
      lifecycleStatus: "graded",
      dueAt: inThreeDays,
    },
  ] as any);
});

afterAll(async () => {
  const d = getDb();
  try {
    await d.execute(sql`DELETE FROM classroomSubmissions WHERE assignmentId IN (
      SELECT id FROM classroomAssignments WHERE externalId LIKE ${TAG + "%"}
    )`);
    await d.execute(sql`DELETE FROM classroomAssignments WHERE externalId LIKE ${TAG + "%"}`);
  } catch {}
});

describe("gclassroom.assignments.activeForToday", () => {
  it("returns the to_do/in_progress + (no-due OR within 7d) rows, drops the others", async () => {
    const rows: any[] = await caller.gclassroom.assignments.activeForToday({
      windowDays: 7,
      limit: 50,
    });
    const ext = (label: string) =>
      ids.find((x) => x.label === label)!.externalId;
    const got = new Set(rows.map((r: any) => r.externalId));

    // Included
    expect(got.has(ext("todo_no_due"))).toBe(true);
    expect(got.has(ext("todo_in_window"))).toBe(true);
    expect(got.has(ext("ip_in_window"))).toBe(true);

    // Excluded
    expect(got.has(ext("todo_past_due"))).toBe(false);
    expect(got.has(ext("todo_far_future"))).toBe(false);
    expect(got.has(ext("graded_in_window"))).toBe(false);
  });

  it("orders by dueAt ascending (nulls allowed at any position the DB chooses)", async () => {
    const rows: any[] = await caller.gclassroom.assignments.activeForToday({
      windowDays: 7,
      limit: 50,
    });
    const ours = rows.filter((r: any) => String(r.externalId).startsWith(TAG));
    const dueDates = ours
      .filter((r: any) => r.dueAt)
      .map((r: any) => new Date(r.dueAt).getTime());
    const sorted = [...dueDates].sort((a, b) => a - b);
    expect(dueDates).toEqual(sorted);
  });

  it("respects windowDays=60 by including the +40d row, and windowDays=1 by excluding +3d", async () => {
    const ext = (label: string) =>
      ids.find((x) => x.label === label)!.externalId;

    const wide: any[] = await caller.gclassroom.assignments.activeForToday({
      windowDays: 60,
      limit: 50,
    });
    expect(wide.find((r: any) => r.externalId === ext("todo_far_future"))).toBeTruthy();

    const tight: any[] = await caller.gclassroom.assignments.activeForToday({
      windowDays: 1,
      limit: 50,
    });
    expect(tight.find((r: any) => r.externalId === ext("todo_in_window"))).toBeFalsy();
    // no-due row must always be included regardless of windowDays
    expect(tight.find((r: any) => r.externalId === ext("todo_no_due"))).toBeTruthy();
  });
});
