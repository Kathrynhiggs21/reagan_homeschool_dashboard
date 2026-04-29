import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("Upload-or-Sync classifier", () => {
  const createdLinkIds: number[] = [];
  const createdNoteIds: number[] = [];
  const createdRunIds: number[] = [];

  beforeAll(async () => {
    // no-op; we'll insert rows during tests and clean up after
  });

  afterAll(async () => {
    // Best-effort cleanup so we don't leak test rows into Adult Analytics.
    const dbi: any = (db as any).getDb();
    if (createdLinkIds.length) {
      const { appLinks } = await import("../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      await dbi.delete(appLinks).where(inArray(appLinks.id, createdLinkIds));
    }
    if (createdNoteIds.length) {
      const { timelineEvents } = await import("../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      await dbi.delete(timelineEvents).where(inArray(timelineEvents.id, createdNoteIds));
    }
    if (createdRunIds.length) {
      const { syncRuns, syncRunItems } = await import("../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      await dbi.delete(syncRunItems).where(inArray(syncRunItems.runId, createdRunIds));
      await dbi.delete(syncRuns).where(inArray(syncRuns.id, createdRunIds));
    }
  });

  it("classifies a Khan link as an app, not a note", async () => {
    const r = await db.classifyAndRoute({
      kind: "link",
      url: "https://www.khanacademy.org/math/cc-fifth-grade-math",
      title: "TEST Khan 5th grade math",
    });
    expect(r.routedTo).toBe("appLink");
    expect(r.recordId).toBeGreaterThan(0);
    createdLinkIds.push(r.recordId);
  });

  it("classifies plain reflective text as a parent note (timelineEvents)", async () => {
    const r = await db.classifyAndRoute({
      kind: "text",
      text: "TEST: Reagan said today felt better and she liked the fraction strips.",
    });
    expect(r.routedTo).toBe("timelineEvent");
    expect(r.recordId).toBeGreaterThan(0);
    createdNoteIds.push(r.recordId);
  });

  it("creates and finishes a sync run with item rows", async () => {
    const run = await db.startSyncRun({ source: "gmail", triggeredBy: "manual" });
    expect(run.id).toBeGreaterThan(0);
    createdRunIds.push(run.id);

    // Route 1 link via the run
    const r = await db.classifyAndRoute({
      kind: "link",
      url: "https://www.ixl.com/math/grade-5",
      title: "TEST IXL grade 5",
    });
    createdLinkIds.push(r.recordId);
    await db.appendSyncRunItem({
      runId: run.id,
      source: "gmail",
      externalId: "test-msg-1",
      routedTo: r.routedTo,
      recordId: r.recordId,
      title: "TEST IXL grade 5",
      message: r.message,
    });
    await db.finishSyncRun({
      runId: run.id,
      itemsScanned: 1,
      itemsRouted: 1,
      itemsSkipped: 0,
      errors: null,
    });

    const summary = await db.getMostRecentSyncSummary();
    expect(summary).toBeTruthy();
    expect(summary!.id).toBe(run.id);
    expect(summary!.itemsRouted).toBe(1);
    expect(summary!.items.length).toBeGreaterThanOrEqual(1);
    expect(summary!.finishedAt).not.toBeNull();
  });

  it("records and pops sync requests", async () => {
    await db.recordSyncRequest({ source: "drive", lookbackDays: 3 });
    const popped = await db.popPendingSyncRequests();
    // Should have at least the one we just recorded
    const ours = popped.find((p) => p.source === "drive" && p.lookbackDays === 3);
    expect(ours).toBeTruthy();

    // Popping again should not return the consumed one
    const again = await db.popPendingSyncRequests();
    const stillThere = again.find((p) => p.id === ours!.id);
    expect(stillThere).toBeFalsy();
  });
});
