import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  drivePushQueue,
  actualAgendaEntries,
  topicsCoveredOffPlan,
} from "../drizzle/schema";
import * as dbMod from "./db";
import {
  dayLogFileName,
  dayLogSubpath,
  enqueueDayLogRebuild,
} from "./_lib/dayLogBuilder";

/**
 * Real-DB integration test for Slice 4.5 push 8 (2026-05-12):
 *   "Daily activity log auto-sync — updated on EVERY dashboard write"
 *
 * Verifies end-to-end:
 *   1. `recordActualEntry` automatically enqueues a pending day-log
 *      `drivePushQueue` row for that date.
 *   2. `queueOffPlanTopicForDriveSync` automatically enqueues a pending
 *      day-log `drivePushQueue` row for that date (in addition to the
 *      topics_covered row it explicitly creates).
 *   3. Direct `enqueueDayLogRebuild` calls are idempotent — calling it
 *      twice with no content change does NOT create a second pending
 *      row.
 *   4. Calling `enqueueDayLogRebuild` AFTER an additional actual entry
 *      DOES create a new pending row (content changed).
 *
 * Uses far-future dates to avoid colliding with real data.
 */

const D1 = "2031-09-03"; // recordActualEntry path (Wed)
const D2 = "2031-09-04"; // queueOffPlanTopicForDriveSync path (Thu)
const D3 = "2031-09-05"; // idempotency + change-detection path (Fri)

async function cleanDate(dateISO: string) {
  const db = (dbMod as any).getDb();
  await db
    .delete(actualAgendaEntries)
    .where(eq(actualAgendaEntries.dateISO, dateISO));
  await db
    .delete(topicsCoveredOffPlan)
    .where(eq(topicsCoveredOffPlan.dateISO, dateISO));
  await db
    .delete(drivePushQueue)
    .where(
      and(
        eq(drivePushQueue.targetFolder as any, "day_log" as any),
        eq(drivePushQueue.fileName as any, dayLogFileName(dateISO) as any),
      ),
    );
  // Also clean topics_covered drivePushQueue rows that belong to this date
  const allRows: any[] = await db.select().from(drivePushQueue);
  for (const row of allRows) {
    if (
      row.targetFolder === "topics_covered" &&
      typeof row.fileName === "string" &&
      row.fileName.startsWith(dateISO)
    ) {
      await db.delete(drivePushQueue).where(eq(drivePushQueue.id, row.id));
    }
  }
}

async function countDayLogPendingRows(dateISO: string): Promise<number> {
  const db = (dbMod as any).getDb();
  const rows: any[] = await db
    .select()
    .from(drivePushQueue)
    .where(
      and(
        eq(drivePushQueue.targetFolder as any, "day_log" as any),
        eq(drivePushQueue.fileName as any, dayLogFileName(dateISO) as any),
        eq(drivePushQueue.status as any, "pending" as any),
      ),
    );
  return rows.length;
}

async function getDayLogPendingRow(dateISO: string): Promise<any | null> {
  const db = (dbMod as any).getDb();
  const rows: any[] = await db
    .select()
    .from(drivePushQueue)
    .where(
      and(
        eq(drivePushQueue.targetFolder as any, "day_log" as any),
        eq(drivePushQueue.fileName as any, dayLogFileName(dateISO) as any),
        eq(drivePushQueue.status as any, "pending" as any),
      ),
    );
  return rows[0] ?? null;
}

beforeAll(async () => {
  await cleanDate(D1);
  await cleanDate(D2);
  await cleanDate(D3);
});

afterAll(async () => {
  try {
    await cleanDate(D1);
    await cleanDate(D2);
    await cleanDate(D3);
  } catch {
    /* ignore */
  }
});

// Small helper: the writers fire-and-forget the enqueue with `void
// import(...).then(...)`. Tests need to wait for the microtask + dynamic
// import to resolve before asserting. 250ms is generous on a hot DB.
async function settle(ms = 1500): Promise<void> {
  // The builder now reads 4 extra sources (completed work, coverage, tutor
  // notes, recap replies) per call — plus we use fire-and-forget dynamic
  // imports. Give the microtask queue + DB roundtrips enough time.
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe("Day Log auto-sync — Slice 4.5 push 8", () => {
  it("recordActualEntry triggers a pending day-log drivePushQueue row for the date", async () => {
    await cleanDate(D1);
    expect(await countDayLogPendingRows(D1)).toBe(0);

    await dbMod.recordActualEntry({
      dateISO: D1,
      subjectSlug: "math",
      topic: "Adding fractions",
      minutesSpent: 25,
      source: "mom-input",
      notes: "First test",
      createdBy: "test@example.com",
    } as any);

    await settle();
    expect(await countDayLogPendingRows(D1)).toBeGreaterThanOrEqual(1);

    const row = await getDayLogPendingRow(D1);
    expect(row).not.toBeNull();
    expect(row.targetFolder).toBe("day_log");
    expect(row.targetSubpath).toBe(dayLogSubpath(D1));
    expect(row.fileName).toBe(dayLogFileName(D1));
    expect(row.mimeType).toBe("text/markdown");
    expect(typeof row.contentText).toBe("string");
    expect(row.contentText).toContain("# Day Log");
    expect(row.contentText).toContain(D1);
    expect(row.contentText).toContain("Adding fractions");
  });

  it("queueOffPlanTopicForDriveSync triggers a pending day-log drivePushQueue row for the date", async () => {
    await cleanDate(D2);
    expect(await countDayLogPendingRows(D2)).toBe(0);

    await dbMod.queueOffPlanTopicForDriveSync(
      D2,
      "life-skills",
      "Baking cookies as fractions",
      null,
      "# Baking cookies as fractions\n\n- ...\n",
    );

    await settle();
    const row = await getDayLogPendingRow(D2);
    expect(row).not.toBeNull();
    expect(row!.targetFolder).toBe("day_log");
    expect(row!.contentText).toContain(D2);
    expect(row!.contentText).toContain("Baking cookies as fractions");
  });

  it("enqueueDayLogRebuild upserts: at most ONE pending row per (date, fileName) regardless of content changes", async () => {
    await cleanDate(D3);

    // First seed an actual entry → triggers an enqueue.
    await dbMod.recordActualEntry({
      dateISO: D3,
      subjectSlug: "math",
      topic: "Topic A",
      minutesSpent: 20,
      source: "mom-input",
      createdBy: "test@example.com",
    } as any);
    await settle();
    const afterFirst = await countDayLogPendingRows(D3);
    expect(afterFirst).toBe(1);

    // Direct call — same content → alreadyQueued=true, count unchanged.
    const r1 = await enqueueDayLogRebuild(D3);
    expect(r1.ok).toBe(true);
    expect(r1.alreadyQueued).toBe(true);
    expect(await countDayLogPendingRows(D3)).toBe(1);

    // Add a second actual entry → content changes, but upsert semantics
    // mean the SAME pending row is updated in place. Count stays at 1.
    await dbMod.recordActualEntry({
      dateISO: D3,
      subjectSlug: "ela",
      topic: "Topic B added later",
      minutesSpent: 15,
      source: "mom-input",
      createdBy: "test@example.com",
    } as any);
    await settle();
    expect(await countDayLogPendingRows(D3)).toBe(1);

    // A direct call with no further change → still upserted, still 1.
    const r2 = await enqueueDayLogRebuild(D3);
    expect(r2.ok).toBe(true);
    expect(r2.alreadyQueued).toBe(true);
    expect(await countDayLogPendingRows(D3)).toBe(1);
  });

  it("enqueueDayLogRebuild rejects malformed dates without throwing or enqueueing", async () => {
    const r = await enqueueDayLogRebuild("not-a-date");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("bad-date");
  });
});
