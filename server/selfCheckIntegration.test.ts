/**
 * selfCheckIntegration.test.ts — REAL-DB test for runNightlySelfCheck.
 *
 * Seeds a far-future plan with a corrupted morning (AM/PM +12h), duplicate
 * pending Drive rows, and a placeholder profile photo, then proves the nightly
 * job repairs all three and is idempotent on a second pass.
 *
 * Far-future date (2031-07) keeps this isolated from real data.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import { getDb, ensurePlanForDate, runNightlySelfCheck } from "./db";
import { scheduleBlocks, drivePushQueue, learnerProfile } from "../drizzle/schema";

const TEST_DATE = "2031-07-15"; // Tuesday
const DUP_FILE = `__SELFCHECK_DUP_${Date.now()}.md`;

async function cleanup() {
  const db = getDb();
  const plan = await db
    .select({ id: (await import("../drizzle/schema")).dailyPlans.id })
    .from((await import("../drizzle/schema")).dailyPlans)
    .where(eq((await import("../drizzle/schema")).dailyPlans.date, TEST_DATE as any));
  for (const p of plan) {
    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, p.id));
  }
  await db.delete(drivePushQueue).where(eq(drivePushQueue.fileName, DUP_FILE));
}

describe("runNightlySelfCheck — real-DB integration", () => {
  let planId = 0;
  let savedPhotoUrl: string | null = null;
  let profileId = 0;

  beforeAll(async () => {
    await cleanup();
    const db = getDb();

    // 1. Seed a plan with a corrupted morning (leading run in evening band).
    const plan = await ensurePlanForDate(TEST_DATE, "full");
    planId = (plan as any).id;
    // Remove any auto-built blocks so we control the fixture precisely.
    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.planId, planId));
    await db.insert(scheduleBlocks).values([
      { planId, blockType: "morning_warmup", title: "Warm-up", durationMin: 30, startTime: "22:00", sortOrder: 0, status: "not_started" },
      { planId, blockType: "math", title: "Math", durationMin: 30, startTime: "22:30", sortOrder: 1, status: "not_started" },
      { planId, blockType: "adventure", title: "Lunch", durationMin: 30, startTime: "12:00", sortOrder: 2, status: "not_started" },
    ] as any);

    // 2. Seed duplicate pending Drive rows (same folder+file).
    // Identical contentHash → true duplicates the conservative dedupe collapses.
    const DUP_HASH = "selfcheckduphash000000000000000000000000000000000000000000000000";
    await db.insert(drivePushQueue).values([
      { targetFolder: "day_log" as any, fileName: DUP_FILE, mimeType: "text/markdown", contentText: "a", contentHash: DUP_HASH, status: "pending" as any },
      { targetFolder: "day_log" as any, fileName: DUP_FILE, mimeType: "text/markdown", contentText: "a", contentHash: DUP_HASH, status: "pending" as any },
      { targetFolder: "day_log" as any, fileName: DUP_FILE, mimeType: "text/markdown", contentText: "a", contentHash: DUP_HASH, status: "pending" as any },
    ] as any);

    // 3. Set a placeholder photo on the profile (remember to restore).
    const profiles = await db.select().from(learnerProfile).limit(1);
    if (profiles.length) {
      profileId = profiles[0].id;
      savedPhotoUrl = profiles[0].photoUrl ?? null;
      await db.update(learnerProfile).set({ photoUrl: "https://example.com/reagan.jpg" }).where(eq(learnerProfile.id, profileId));
    }
  });

  afterAll(async () => {
    const db = getDb();
    if (profileId) {
      await db.update(learnerProfile).set({ photoUrl: savedPhotoUrl }).where(eq(learnerProfile.id, profileId));
    }
    await cleanup();
  });

  it("repairs corrupted morning times, removes duplicate pending rows, clears placeholder photo", async () => {
    const report = await runNightlySelfCheck({ todayISO: TEST_DATE, lookbackDays: 0, lookaheadDays: 1 });

    expect(report.clean).toBe(false);
    // Our seeded day contributes exactly 2 leading-run fixes. Other future
    // days could in principle add more, so assert "at least our 2" and verify
    // our specific block times below.
    expect(report.timeFixes.length).toBeGreaterThanOrEqual(2);
    // The global pending scan may also collapse pre-existing duplicates in the
    // shared test DB; our 3 seeded rows contribute 2 removals. Assert >= 2 and
    // verify our seeded file is collapsed to exactly 1 below.
    expect(report.duplicatePendingRemoved).toBeGreaterThanOrEqual(2);
    expect(report.placeholderPhotosCleared).toBeGreaterThanOrEqual(1);

    const db = getDb();
    const blocks = await db
      .select({ startTime: scheduleBlocks.startTime, sortOrder: scheduleBlocks.sortOrder })
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.planId, planId));
    const byOrder = new Map<number, string | null>(blocks.map((b) => [b.sortOrder, b.startTime]));
    expect(byOrder.get(0)).toBe("10:00");
    expect(byOrder.get(1)).toBe("10:30");
    expect(byOrder.get(2)).toBe("12:00"); // afternoon kept

    const remaining = await db
      .select({ id: drivePushQueue.id })
      .from(drivePushQueue)
      .where(and(eq(drivePushQueue.fileName, DUP_FILE), eq(drivePushQueue.status, "pending" as any)));
    expect(remaining.length).toBe(1);

    if (profileId) {
      const after = await db.select({ photoUrl: learnerProfile.photoUrl }).from(learnerProfile).where(eq(learnerProfile.id, profileId));
      expect(after[0].photoUrl).toBeNull();
    }
  });

  it("is idempotent — a second run reports clean", async () => {
    const report = await runNightlySelfCheck({ todayISO: TEST_DATE, lookbackDays: 0, lookaheadDays: 1 });
    expect(report.timeFixes.length).toBe(0);
    expect(report.duplicatePendingRemoved).toBe(0);
    expect(report.placeholderPhotosCleared).toBe(0);
    expect(report.clean).toBe(true);
  });

  it("dryRun computes findings without writing", async () => {
    const db = getDb();
    // Re-corrupt one block, then dry-run.
    await db.update(scheduleBlocks).set({ startTime: "23:00" }).where(and(eq(scheduleBlocks.planId, planId), eq(scheduleBlocks.sortOrder, 0)));
    const report = await runNightlySelfCheck({ todayISO: TEST_DATE, lookbackDays: 0, lookaheadDays: 1, dryRun: true });
    expect(report.timeFixes.length).toBe(1);
    // Not written:
    const blk = await db.select({ startTime: scheduleBlocks.startTime }).from(scheduleBlocks).where(and(eq(scheduleBlocks.planId, planId), eq(scheduleBlocks.sortOrder, 0)));
    expect(blk[0].startTime).toBe("23:00");
    // Repair for real to leave clean state.
    await runNightlySelfCheck({ todayISO: TEST_DATE, lookbackDays: 0, lookaheadDays: 1 });
  });
});
