import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";
import { registerScheduledSync } from "./scheduledSync";
import * as db from "./db";
import { drivePushQueue } from "../drizzle/schema";
import { eq, like } from "drizzle-orm";

let server: Server;
let baseUrl = "";
const TEST_FILE_KEY_PREFIX = "vitest-fixture-drive/";

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  registerScheduledSync(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (addr && typeof addr === "object") baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  // Clean up any rows we created
  const dbi = db.getDb();
  await dbi.delete(drivePushQueue).where(like(drivePushQueue.fileKey, `${TEST_FILE_KEY_PREFIX}%`));
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("Drive push queue", () => {
  it("enqueues a pending row and lists it", async () => {
    const fileKey = `${TEST_FILE_KEY_PREFIX}${Date.now()}-a.png`;
    const { id } = await db.enqueueDrivePush({
      fileKey,
      fileUrl: `/manus-storage/${fileKey}`,
      fileName: "homework-a.png",
      mimeType: "image/png",
      targetFolder: "reagan_assignments",
    });
    expect(id).toBeGreaterThan(0);

    const pending = await db.listPendingDrivePushes(200);
    const mine = (pending as any[]).find((r) => r.id === id);
    expect(mine, "row should be in pending list").toBeTruthy();
    expect(mine.status).toBe("pending");
    expect(mine.targetFolder).toBe("reagan_assignments");
  });

  it("markDrivePushResult moves row out of pending into pushed", async () => {
    const fileKey = `${TEST_FILE_KEY_PREFIX}${Date.now()}-b.pdf`;
    const { id } = await db.enqueueDrivePush({
      fileKey,
      fileUrl: `/manus-storage/${fileKey}`,
      fileName: "wells-curriculum-q4.pdf",
      mimeType: "application/pdf",
      targetFolder: "reagan_ihes",
    });
    await db.markDrivePushResult({ id, status: "pushed", driveFileId: "drive-id-test-1" });

    const dbi = db.getDb();
    const [row] = (await dbi.select().from(drivePushQueue).where(eq(drivePushQueue.id, id))) as any[];
    expect(row.status).toBe("pushed");
    expect(row.driveFileId).toBe("drive-id-test-1");
    expect(row.pushedAt).toBeTruthy();

    // No longer in pending
    const pending = await db.listPendingDrivePushes(200);
    expect((pending as any[]).find((r) => r.id === id)).toBeUndefined();
  });

  it("pickDriveFolderForRouted maps routes to the right folder", () => {
    const item: any = { kind: "file", fileUrl: "u", fileName: "x.png", mimeType: "image/png" };
    expect(
      db.pickDriveFolderForRouted(
        { kind: "file", routedTo: "submission", recordId: 1, routedToLabel: "Today (turn-in)", routedToHref: "/today", message: "" },
        item,
      ),
    ).toBe("reagan_assignments");

    expect(
      db.pickDriveFolderForRouted(
        { kind: "file", routedTo: "timelineEvent", recordId: 2, routedToLabel: "Curriculum library", routedToHref: "/whiteboard", message: "" },
        item,
      ),
    ).toBe("reagan_ihes");

    expect(
      db.pickDriveFolderForRouted(
        { kind: "file", routedTo: "tutorSession", recordId: 3, routedToLabel: "Tutor Handoff", routedToHref: "/tutor", message: "" },
        item,
      ),
    ).toBe("reagan_tutor");

    expect(
      db.pickDriveFolderForRouted(
        { kind: "file", routedTo: "timelineEvent", recordId: 4, routedToLabel: "Parent Notes", routedToHref: "/whiteboard", message: "" },
        item,
      ),
    ).toBe("reagan");

    // Non-file items don't push to Drive
    expect(
      db.pickDriveFolderForRouted(
        { kind: "link", routedTo: "appLink", recordId: 5, routedToLabel: "Apps & Tools", routedToHref: "/apps", message: "" },
        { kind: "link", url: "https://example.com" } as any,
      ),
    ).toBe("reagan");
  });

  it("scheduled-task drive endpoints reject anonymous calls (401)", async () => {
    const r1 = await fetch(`${baseUrl}/api/scheduled/drive-push/pending`);
    expect(r1.status).toBe(401);
    const r2 = await fetch(`${baseUrl}/api/scheduled/drive-push/result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1, status: "pushed" }),
    });
    expect(r2.status).toBe(401);
  });
});
