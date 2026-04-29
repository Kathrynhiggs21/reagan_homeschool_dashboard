import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { syncRuns, syncRunItems } from "../drizzle/schema";
import { eq } from "drizzle-orm";

let testRunId = 0;
const testItemIds: number[] = [];

beforeAll(async () => {
  const dbi = db.getDb();
  const ins: any = await dbi.insert(syncRuns).values({
    source: "manual",
    triggeredBy: "vitest:automationFeed",
    itemsScanned: 2,
    itemsRouted: 2,
    itemsSkipped: 0,
    finishedAt: new Date(),
  });
  testRunId =
    ins?.insertId ??
    ins?.[0]?.insertId ??
    (
      await dbi.select().from(syncRuns).where(eq(syncRuns.triggeredBy, "vitest:automationFeed"))
    )[0]?.id ??
    0;

  for (let i = 0; i < 2; i++) {
    const itm: any = await dbi.insert(syncRunItems).values({
      runId: testRunId,
      source: "gmail",
      externalId: `vitest-feed-${Date.now()}-${i}`,
      routedTo: "timelineEvent",
      recordId: 0,
      title: `Vitest feed item ${i}`,
      message: "auto",
    });
    const newId =
      itm?.insertId ??
      itm?.[0]?.insertId ??
      (await dbi.select().from(syncRunItems).where(eq(syncRunItems.runId, testRunId)))[
        i
      ]?.id;
    if (newId) testItemIds.push(newId);
  }
});

afterAll(async () => {
  const dbi = db.getDb();
  for (const id of testItemIds) {
    await dbi.delete(syncRunItems).where(eq(syncRunItems.id, id));
  }
  if (testRunId) {
    await dbi.delete(syncRuns).where(eq(syncRuns.id, testRunId));
  }
});

describe("Automation feed", () => {
  it("automationStatus surfaces last run + 7-day count", async () => {
    const s = await db.automationStatus();
    expect(s.latestRunAt).toBeTruthy();
    expect(s.last7DaysItems).toBeGreaterThanOrEqual(2);
  });

  it("listRecentAutomationRuns returns the run", async () => {
    const runs = await db.listRecentAutomationRuns(20);
    const found = runs.find((r) => r.id === testRunId);
    expect(found).toBeDefined();
  });

  it("listAutomationItemsForRun returns items for the run", async () => {
    const items = await db.listAutomationItemsForRun(testRunId);
    expect(items.length).toBe(2);
  });

  it("dismissAutomationItem hides the item from active feed", async () => {
    const target = testItemIds[0];
    await db.dismissAutomationItem(target, "test dismiss");
    const items = await db.listAutomationItemsForRun(testRunId);
    const dismissed = items.find((i) => i.id === target);
    expect(dismissed?.dismissed).toBe(true);
    expect(dismissed?.parentNote).toBe("test dismiss");
  });

  it("flagAutomationItem raises pendingFlags count", async () => {
    const target = testItemIds[1];
    await db.flagAutomationItem(target, "needs review");
    const s = await db.automationStatus();
    expect(s.pendingFlags).toBeGreaterThanOrEqual(1);
  });
});
