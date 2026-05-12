import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import * as dbMod from "./db";
import { assignmentsLibrary } from "../drizzle/schema";
import { hydrateLessonForBlock } from "./_lib/hydrateLessonForBlock";

/**
 * Real-DB integration test for `hydrateLessonForBlock` and the wired-in
 * lesson hydration in `assembleAgendaForDate`.
 *
 * Proves the gap discovered 2026-05-12 push 6 is fixed:
 *   `assembleAgendaForDate` previously did NOT pull `assignmentsLibrary`
 *   rows pinned to a block's `blockId`, so the nightly packet PDF rendered
 *   with empty per-block lesson pages — no worksheets, no answer keys.
 *
 * Strategy: insert real `assignmentsLibrary` rows pinned to a synthetic
 * blockId (a far-future id we won't collide with), call the hydrator, and
 * assert it produces the expected `lesson` payload shape that
 * `agendaPdf.ts` consumes.
 */

// Use a synthetic blockId far enough out that it cannot collide with any
// real schedule block in the test DB. We don't actually need a real block
// row — `assignmentsLibrary.blockId` is just an int FK with no enforced
// integrity at this layer.
const TEST_BLOCK_ID = 999_876_543;

beforeAll(async () => {
  const db = (dbMod as any).getDb();
  await db
    .delete(assignmentsLibrary)
    .where(eq(assignmentsLibrary.blockId, TEST_BLOCK_ID));
});

afterAll(async () => {
  const db = (dbMod as any).getDb();
  await db
    .delete(assignmentsLibrary)
    .where(eq(assignmentsLibrary.blockId, TEST_BLOCK_ID));
});

describe("hydrateLessonForBlock — real DB", () => {
  it("returns null when no assignmentsLibrary rows exist for the block", async () => {
    const lesson = await hydrateLessonForBlock(TEST_BLOCK_ID);
    expect(lesson).toBeNull();
  });

  it("groups lesson_plan + worksheet + answer_key + video rows into the lesson payload", async () => {
    await dbMod.addAssignmentLibrary({
      title: "Adding Unlike Fractions — Lesson",
      type: "lesson_plan",
      subjectSlug: "math",
      blockId: TEST_BLOCK_ID,
      notes: "Walk through how to find common denominators step by step.",
    });
    await dbMod.addAssignmentLibrary({
      title: "Practice Set A",
      type: "worksheet",
      subjectSlug: "math",
      blockId: TEST_BLOCK_ID,
      notes: "Five problems untimed",
      fileLink: "https://example.com/worksheet-A.pdf",
    });
    await dbMod.addAssignmentLibrary({
      title: "Answer key for Practice Set A",
      type: "answer_key",
      subjectSlug: "math",
      blockId: TEST_BLOCK_ID,
      notes: "1) 5/6  2) 11/12  3) 13/20",
    });
    await dbMod.addAssignmentLibrary({
      title: "Khan Academy: Adding Fractions",
      type: "video",
      subjectSlug: "math",
      blockId: TEST_BLOCK_ID,
      sourceUrl: "https://www.khanacademy.org/example",
      notes: "Sal Khan walks through the method.",
    });

    const lesson = await hydrateLessonForBlock(TEST_BLOCK_ID);
    expect(lesson).not.toBeNull();
    expect(lesson!.instructions).toContain("common denominators");
    expect(lesson!.worksheets!.length).toBe(1);
    expect(lesson!.worksheets![0].title).toBe("Practice Set A");
    expect(lesson!.worksheets![0].printableUrl).toBe(
      "https://example.com/worksheet-A.pdf",
    );
    expect(lesson!.answerKey).toContain("5/6");
    expect(lesson!.answerKey).toContain("11/12");
    expect(lesson!.videos!.length).toBe(1);
    expect(lesson!.videos![0].url).toBe(
      "https://www.khanacademy.org/example",
    );
  });

  it("returns null after we delete every row again (proves we're reading live)", async () => {
    const db = (dbMod as any).getDb();
    await db
      .delete(assignmentsLibrary)
      .where(eq(assignmentsLibrary.blockId, TEST_BLOCK_ID));
    const lesson = await hydrateLessonForBlock(TEST_BLOCK_ID);
    expect(lesson).toBeNull();
  });

  it("ignores unknown / non-renderable assignment types (returns null when only those exist)", async () => {
    await dbMod.addAssignmentLibrary({
      title: "Reading: Tuck Everlasting Ch.4",
      type: "reading",
      subjectSlug: "ela",
      blockId: TEST_BLOCK_ID,
    });
    await dbMod.addAssignmentLibrary({
      title: "Diorama project",
      type: "project",
      subjectSlug: "art",
      blockId: TEST_BLOCK_ID,
    });
    const lesson = await hydrateLessonForBlock(TEST_BLOCK_ID);
    expect(lesson).toBeNull();
  });
});

describe("agendaAssembler wiring — source-level", () => {
  it("agendaAssembler imports hydrateLessonForBlock and assigns lesson onto AgendaPdfBlock", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      __dirname + "/_lib/agendaAssembler.ts",
      "utf8",
    );
    expect(src).toContain('from "./hydrateLessonForBlock"');
    expect(src).toContain("hydrateLessonForBlock(b.id)");
    expect(src).toMatch(/lesson:\s*lessonByBlockId\.get\(b\.id\)\s*\?\?\s*null/);
  });
});
