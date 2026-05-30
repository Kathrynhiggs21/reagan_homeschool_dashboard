/**
 * Integration test for `handleGenerateWorksheet` — exercises the full
 * persist + attach flow using a stubbed LLM, against the real DB.
 *
 * Locked behaviors:
 *   1. Attach to existing block: target block's title/description updated,
 *      a new assignmentsLibrary row created with type="worksheet",
 *      fromSource="ai_chat", blockId pointing at the target block.
 *   2. Create new block: new "custom" block appears at end of plan,
 *      assignmentsLibrary row pinned to the new block.
 *   3. Vision / sourceAttachmentUrl path: the attachment URL is forwarded
 *      to the LLM in image_url content (verified via stub assertions).
 *   4. Empty LLM response throws — no placeholder content is persisted.
 *   5. Non-JSON LLM response throws — no placeholder content is persisted.
 *   6. Persisted notes contain the expected printable Markdown body.
 *
 * The test uses a unique fixture date well in the future to avoid
 * polluting today's plan, and cleans up everything it creates.
 */
import { describe, it, expect, afterEach } from "vitest";
import { eq, and, inArray } from "drizzle-orm";
import * as db from "./db";
import { handleGenerateWorksheet } from "./_lib/agendaEditorWorksheetOp";
import { scheduleBlocks, assignmentsLibrary } from "../drizzle/schema";

const FUTURE_DATE = "2099-09-09"; // far enough out that no real plan exists

const subjectIdBySlug = new Map<string, number>();

async function ensureFuturePlan() {
  const plan = await db.ensurePlanForDate(FUTURE_DATE, "full" as any, {
    allowWeekendAutoBuild: true,
  } as any);
  if (!plan) throw new Error("future plan missing");
  // Hydrate subject map once per run.
  if (subjectIdBySlug.size === 0) {
    const subjects = await db.listSubjects();
    for (const s of subjects as any[]) subjectIdBySlug.set(s.slug, s.id);
  }
  return plan;
}

async function cleanupFuturePlan(planId: number) {
  const d = (db as any).getDb();
  // Remove any assignmentsLibrary rows we created tagged with ai_chat
  // for blocks on this plan.
  const planBlocks: any[] = await d.select().from(scheduleBlocks).where(eq(scheduleBlocks.planId, planId));
  const blockIds = planBlocks.map((b) => b.id);
  if (blockIds.length) {
    try {
      await d.delete(assignmentsLibrary).where(inArray(assignmentsLibrary.blockId, blockIds));
    } catch {}
  }
  try {
    await d.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, planId));
  } catch {}
}

/** Build a fake invokeLLM that returns the given worksheet JSON. */
function llmStubWith(worksheet: { title: string; instructions: string; questions: string[] }) {
  const calls: any[] = [];
  const fn = (async (args: any) => {
    calls.push(args);
    return {
      choices: [{ message: { content: JSON.stringify(worksheet) } }],
    } as any;
  }) as any;
  return { fn, calls };
}

describe("handleGenerateWorksheet — integration", () => {
  let createdPlanId: number | null = null;

  afterEach(async () => {
    if (createdPlanId != null) {
      await cleanupFuturePlan(createdPlanId);
      createdPlanId = null;
    }
  });

  it("attaches a worksheet to an existing target block", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;

    // Create a host block first
    const insertedRaw = await db.createBlock({
      planId: plan.id,
      blockType: "math" as any,
      subjectId: subjectIdBySlug.get("math") ?? null,
      title: "Original math block",
      description: "Original description",
      durationMin: 30,
      startTime: "09:00",
      sortOrder: 100,
      status: "not_started" as any,
    } as any);
    const targetBlockId =
      typeof insertedRaw === "number" ? insertedRaw
      : (insertedRaw as any)?.id ?? (insertedRaw as any)?.insertId;
    expect(targetBlockId).toBeTruthy();

    const stub = llmStubWith({
      title: "Long Division Practice",
      instructions: "Solve each problem and show remainders.",
      questions: ["384 ÷ 12", "525 ÷ 15", "672 ÷ 14"],
    });

    const result = await handleGenerateWorksheet({
      planId: plan.id,
      targetBlockId,
      topic: "long division with remainders",
      subjectSlug: "math",
      gradeLevel: "5th grade",
      questionCount: 3,
      style: "practice",
      sourceAttachmentUrl: null,
      subjectIdBySlug,
      liveBlockCount: 1,
      dateFor: FUTURE_DATE,
      llmInvoker: stub.fn,
    } as any);

    expect(result.createdNewBlock).toBe(false);
    expect(result.blockId).toBe(targetBlockId);
    expect(result.assignmentLibraryId).toBeTruthy();
    expect(result.questionCount).toBe(3);

    // Verify block was updated
    const blocks: any[] = await db.listBlocksForPlan(plan.id);
    const updated = blocks.find((b) => b.id === targetBlockId);
    expect(updated?.title).toBe("Long Division Practice");
    expect(updated?.description).toMatch(/Solve each problem/);

    // Verify assignmentsLibrary row exists and has the markdown body
    const d = (db as any).getDb();
    const libRows: any[] = await d.select().from(assignmentsLibrary).where(eq(assignmentsLibrary.id, result.assignmentLibraryId!));
    expect(libRows).toHaveLength(1);
    expect(libRows[0].type).toBe("worksheet");
    expect(libRows[0].fromSource).toBe("ai_chat");
    expect(libRows[0].blockId).toBe(targetBlockId);
    expect(libRows[0].notes).toMatch(/# Long Division Practice/);
    expect(libRows[0].notes).toMatch(/1\. 384/);
    expect(libRows[0].notes).toMatch(/2\. 525/);
    expect(libRows[0].notes).toMatch(/3\. 672/);
  });

  it("creates a new custom block when targetBlockId is null", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;

    const stub = llmStubWith({
      title: "Decimal Place Value Quiz",
      instructions: "Read each decimal carefully.",
      questions: ["What is the place value of 7 in 3.471?", "Round 4.829 to the nearest tenth."],
    });

    const before = await db.listBlocksForPlan(plan.id);

    const result = await handleGenerateWorksheet({
      planId: plan.id,
      targetBlockId: null,
      topic: "decimal place value",
      subjectSlug: "math",
      gradeLevel: "5th grade",
      questionCount: 2,
      style: "quiz",
      sourceAttachmentUrl: null,
      subjectIdBySlug,
      liveBlockCount: before.length,
      dateFor: FUTURE_DATE,
      llmInvoker: stub.fn,
    } as any);

    expect(result.createdNewBlock).toBe(true);
    expect(result.blockId).toBeGreaterThan(0);

    const after = await db.listBlocksForPlan(plan.id);
    const newBlock: any = after.find((b: any) => b.id === result.blockId);
    expect(newBlock).toBeTruthy();
    expect(newBlock.blockType).toBe("custom");
    expect(newBlock.title).toBe("Decimal Place Value Quiz");
  });

  it("forwards sourceAttachmentUrl to the LLM as image_url content", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;

    const stub = llmStubWith({
      title: "Photo-based Practice",
      instructions: "Practice the same kind of problems.",
      questions: ["Q1 like the photo", "Q2 like the photo"],
    });

    await handleGenerateWorksheet({
      planId: plan.id,
      targetBlockId: null,
      topic: "match the worksheet I attached",
      subjectSlug: "math",
      gradeLevel: "5th grade",
      questionCount: 2,
      style: "practice",
      sourceAttachmentUrl: "/manus-storage/agenda-attachments/test.jpg",
      subjectIdBySlug,
      liveBlockCount: 0,
      dateFor: FUTURE_DATE,
      llmInvoker: stub.fn,
    } as any);

    expect(stub.calls).toHaveLength(1);
    const userMsg = stub.calls[0].messages.find((m: any) => m.role === "user");
    expect(Array.isArray(userMsg.content)).toBe(true);
    const imageEntry = userMsg.content.find((c: any) => c.type === "image_url");
    expect(imageEntry).toBeTruthy();
    expect(imageEntry.image_url.url).toBe("/manus-storage/agenda-attachments/test.jpg");
  });

  it("throws when LLM returns empty content (no placeholder is persisted)", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;

    const before = await db.listBlocksForPlan(plan.id);
    const beforeCount = before.length;

    const emptyStub = (async () => ({ choices: [{ message: { content: "" } }] }) as any) as any;

    await expect(
      handleGenerateWorksheet({
        planId: plan.id,
        targetBlockId: null,
        topic: "long division",
        subjectSlug: "math",
        gradeLevel: "5th grade",
        questionCount: 5,
        style: "practice",
        sourceAttachmentUrl: null,
        subjectIdBySlug,
        liveBlockCount: beforeCount,
        dateFor: FUTURE_DATE,
        llmInvoker: emptyStub,
      } as any),
    ).rejects.toThrow(/empty/i);

    const after = await db.listBlocksForPlan(plan.id);
    expect(after.length).toBe(beforeCount); // no block was created
  });

  it("throws when LLM returns non-JSON output", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;

    const garbageStub = (async () => ({
      choices: [{ message: { content: "this is not JSON at all" } }],
    }) as any) as any;

    await expect(
      handleGenerateWorksheet({
        planId: plan.id,
        targetBlockId: null,
        topic: "something",
        subjectSlug: null,
        gradeLevel: "5th grade",
        questionCount: 5,
        style: "practice",
        sourceAttachmentUrl: null,
        subjectIdBySlug,
        liveBlockCount: 0,
        dateFor: FUTURE_DATE,
        llmInvoker: garbageStub,
      } as any),
    ).rejects.toThrow(/non-JSON|malformed/i);
  });

  it("throws when LLM returns zero questions", async () => {
    const plan = await ensureFuturePlan();
    createdPlanId = plan.id;

    const stub = llmStubWith({
      title: "Empty",
      instructions: "Nothing to do.",
      questions: [],
    });

    await expect(
      handleGenerateWorksheet({
        planId: plan.id,
        targetBlockId: null,
        topic: "x",
        subjectSlug: null,
        gradeLevel: null,
        questionCount: 5,
        style: "practice",
        sourceAttachmentUrl: null,
        subjectIdBySlug,
        liveBlockCount: 0,
        dateFor: FUTURE_DATE,
        llmInvoker: stub.fn,
      } as any),
    ).rejects.toThrow(/questions/i);
  });
});
