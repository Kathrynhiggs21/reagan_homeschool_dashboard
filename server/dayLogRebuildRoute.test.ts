import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import type { Server } from "http";
import { and, eq, like } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { registerScheduledSync } from "./scheduledSync";
import { drivePushQueue } from "../drizzle/schema";
import { dayLogFileName, dayLogSubpath } from "./_lib/dayLogBuilder";
import * as dbMod from "./db";

/**
 * Real-DB + real-express integration test for
 *   POST /api/scheduled/daily-log-rebuild
 *
 * Verifies:
 *  1. Anonymous POST is rejected (401).
 *  2. Authenticated POST enqueues a pending drive-push row with
 *     targetFolder="day_log", correct subpath ("YYYY-MM") and fileName
 *     ("YYYY-MM-DD - Day Log.md"), and bytes > 0.
 *  3. A second authenticated POST for the same date with the same
 *     generated content returns alreadyQueued=true (no duplicate row).
 */

let server: Server;
let baseUrl = "";

// Use a far-future date so we never collide with real data, weekends, or
// the natural day-log rebuild cron.
const FUTURE_DATE = "2031-05-20"; // a Tuesday

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  registerScheduledSync(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (addr && typeof addr === "object") {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }

  // Make sure we start clean
  const db = (dbMod as any).getDb();
  await db
    .delete(drivePushQueue)
    .where(
      and(
        eq(drivePushQueue.targetFolder as any, "day_log" as any),
        eq(drivePushQueue.fileName as any, dayLogFileName(FUTURE_DATE) as any),
      ),
    );
});

afterAll(async () => {
  vi.restoreAllMocks();
  // Clean up rows we created
  try {
    const db = (dbMod as any).getDb();
    await db
      .delete(drivePushQueue)
      .where(
        and(
          eq(drivePushQueue.targetFolder as any, "day_log" as any),
          eq(drivePushQueue.fileName as any, dayLogFileName(FUTURE_DATE) as any),
        ),
      );
  } catch {
    /* ignore */
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("/api/scheduled/daily-log-rebuild route", () => {
  it("rejects anonymous POST with 401", async () => {
    const r = await fetch(`${baseUrl}/api/scheduled/daily-log-rebuild`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dateISO: FUTURE_DATE }),
    });
    expect(r.status).toBe(401);
    const body: any = await r.json();
    expect(body.ok).toBe(false);
  });

  it("authenticated POST enqueues a day-log row and reports correct metadata", async () => {
    // Stub authenticateRequest to return an admin user without touching cookies.
    const spy = vi
      .spyOn(sdk, "authenticateRequest")
      .mockResolvedValue({ openId: "test-admin", role: "admin" } as any);

    try {
      const r = await fetch(`${baseUrl}/api/scheduled/daily-log-rebuild`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dateISO: FUTURE_DATE }),
      });
      expect(r.status).toBe(200);
      const body: any = await r.json();
      expect(body.ok).toBe(true);
      expect(body.dateISO).toBe(FUTURE_DATE);
      expect(body.fileName).toBe(dayLogFileName(FUTURE_DATE));
      expect(body.subpath).toBe(dayLogSubpath(FUTURE_DATE));
      expect(body.bytes).toBeGreaterThan(0);
      // First call cannot be already-queued
      expect(body.alreadyQueued).toBe(false);

      // Verify a real pending row was inserted
      const db = (dbMod as any).getDb();
      const rows: any[] = await db
        .select()
        .from(drivePushQueue)
        .where(
          and(
            eq(drivePushQueue.targetFolder as any, "day_log" as any),
            eq(drivePushQueue.fileName as any, dayLogFileName(FUTURE_DATE) as any),
            eq(drivePushQueue.status as any, "pending" as any),
          ),
        );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const row = rows[0];
      expect(row.targetSubpath).toBe(dayLogSubpath(FUTURE_DATE));
      expect(row.mimeType).toBe("text/markdown");
      expect(typeof row.contentText).toBe("string");
      expect(row.contentText.length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("second POST for same date with identical content reports alreadyQueued=true", async () => {
    const spy = vi
      .spyOn(sdk, "authenticateRequest")
      .mockResolvedValue({ openId: "test-admin", role: "admin" } as any);

    try {
      const r = await fetch(`${baseUrl}/api/scheduled/daily-log-rebuild`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dateISO: FUTURE_DATE }),
      });
      expect(r.status).toBe(200);
      const body: any = await r.json();
      expect(body.ok).toBe(true);
      expect(body.alreadyQueued).toBe(true);

      // And the queue should still contain exactly one pending row for this date.
      const db = (dbMod as any).getDb();
      const rows: any[] = await db
        .select()
        .from(drivePushQueue)
        .where(
          and(
            eq(drivePushQueue.targetFolder as any, "day_log" as any),
            eq(drivePushQueue.fileName as any, dayLogFileName(FUTURE_DATE) as any),
            eq(drivePushQueue.status as any, "pending" as any),
          ),
        );
      expect(rows.length).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});
