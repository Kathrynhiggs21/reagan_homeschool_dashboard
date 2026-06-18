import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, queueOffPlanTopicForDriveSync } from "./db";
import { drivePushQueue } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";

/**
 * REAL-DB integration tests for the Slice 4.5 drivePushQueue extension.
 *
 * These specs replace the source-string-matching tests from push 4 that gave
 * a false sense of safety while queueOffPlanTopicForDriveSync was actually
 * broken at insert time (wrong column names, missing enum values, required
 * fileKey/fileUrl). The migration 0060 + helper rewrite must now work
 * end-to-end against the live DB.
 */

const TEST_DATE = "2031-04-15";
const TEST_SUBJECT = "art";
const TEST_TOPIC = `INTEGRATION_TEST_TOPIC_${Date.now()}`;

describe("Slice 4.5 — drivePushQueue real-DB integration", () => {
  beforeAll(async () => {
    const db = getDb();
    // Clean any prior test residue.
    await db
      .delete(drivePushQueue)
      .where(eq(drivePushQueue.fileName as any, `${TEST_DATE} - ${TEST_SUBJECT} - ${TEST_TOPIC}.md` as any));
  });

  afterAll(async () => {
    const db = getDb();
    await db
      .delete(drivePushQueue)
      .where(eq(drivePushQueue.fileName as any, `${TEST_DATE} - ${TEST_SUBJECT} - ${TEST_TOPIC}.md` as any));
  });

  it("queueOffPlanTopicForDriveSync inserts a real row with content_text + target_subpath", async () => {
    const db = getDb();
    const md = `# ${TEST_TOPIC}\n\nIntegration test markdown body — Slice 4.5.\n`;
    const result = await queueOffPlanTopicForDriveSync(TEST_DATE, TEST_SUBJECT, TEST_TOPIC, null, md);
    expect(result.queued).toBe(true);
    expect(result.topicId).toBeGreaterThan(0);

    const rows: any[] = await db
      .select()
      .from(drivePushQueue)
      .where(
        and(
          eq(drivePushQueue.targetFolder as any, "topics_covered" as any),
          eq(drivePushQueue.fileName as any, `${TEST_DATE} - ${TEST_SUBJECT} - ${TEST_TOPIC}.md` as any),
        ),
      )
      .limit(1);

    expect(rows.length).toBe(1);
    expect(rows[0].targetFolder).toBe("topics_covered");
    // Flattened 2026-06-18: dated filename, no {YYYY-MM} subfolder.
    expect(rows[0].targetSubpath).toBe("");
    expect(rows[0].mimeType).toBe("text/markdown");
    expect(rows[0].contentText).toBe(md);
    expect(rows[0].status).toBe("pending");
    // fileKey + fileUrl should be null (inline-content path)
    expect(rows[0].fileKey).toBeNull();
    expect(rows[0].fileUrl).toBeNull();
  });

  it("rejects an unknown target_folder enum value", async () => {
    const db = getDb();
    let failed = false;
    try {
      await db.insert(drivePushQueue).values({
        targetFolder: "not_a_real_target" as any,
        fileName: "x.md",
        mimeType: "text/markdown",
        contentText: "x",
        status: "pending" as any,
      } as any);
    } catch (e) {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it("accepts all 4 new Slice 4.5 enum values", async () => {
    const db = getDb();
    const ts = Date.now();
    const newTargets = ["day_log", "recap_reply", "topics_covered", "agenda_pdf"] as const;
    const fileNames = newTargets.map((t) => `__SCHEMA_TEST_${t}_${ts}.md`);
    try {
      for (let i = 0; i < newTargets.length; i++) {
        await db.insert(drivePushQueue).values({
          targetFolder: newTargets[i] as any,
          targetSubpath: "2031-04",
          fileName: fileNames[i],
          mimeType: "text/markdown",
          contentText: `# probe ${newTargets[i]}`,
          status: "pending" as any,
        } as any);
      }
      const rows: any[] = await db
        .select()
        .from(drivePushQueue)
        .where(eq(drivePushQueue.targetSubpath as any, "2031-04" as any));
      const targetsFound = new Set(rows.map((r: any) => r.targetFolder));
      for (const t of newTargets) {
        expect(targetsFound.has(t)).toBe(true);
      }
    } finally {
      for (const fn of fileNames) {
        await db.delete(drivePushQueue).where(eq(drivePushQueue.fileName as any, fn as any));
      }
    }
  });

  it("classic file-URL rows still work after migration (back-compat)", async () => {
    const db = getDb();
    const ts = Date.now();
    const probeFileName = `__BACKCOMPAT_PROBE_${ts}.pdf`;
    try {
      await db.insert(drivePushQueue).values({
        fileKey: "probe-key",
        fileUrl: "/manus-storage/probe-key",
        fileName: probeFileName,
        mimeType: "application/pdf",
        targetFolder: "worksheets" as any,
        status: "pending" as any,
      } as any);
      const rows: any[] = await db
        .select()
        .from(drivePushQueue)
        .where(eq(drivePushQueue.fileName as any, probeFileName as any))
        .limit(1);
      expect(rows.length).toBe(1);
      expect(rows[0].fileKey).toBe("probe-key");
      expect(rows[0].fileUrl).toBe("/manus-storage/probe-key");
      expect(rows[0].targetSubpath).toBeNull();
      expect(rows[0].contentText).toBeNull();
    } finally {
      await db.delete(drivePushQueue).where(eq(drivePushQueue.fileName as any, probeFileName as any));
    }
  });
});
