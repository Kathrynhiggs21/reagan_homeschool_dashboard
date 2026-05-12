import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import type { Server } from "http";
import { eq } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { registerScheduledSync } from "./scheduledSync";
import {
  actualAgendaEntries,
  dailyRecapRequests,
} from "../drizzle/schema";
import * as dbMod from "./db";

/**
 * Real-DB + real-Express integration test for the 8 PM recap cron:
 *   POST /api/scheduled/daily-recap-send
 *
 * Behaviors verified end-to-end (no mocks of the DB or the route logic):
 *   1. SKIP when actualAgendaEntries already has rows for the date
 *      → response { ok:true, skipped:"actual-entries-exist", actualCount }
 *      → no recap-request rows are created.
 *   2. SKIP when a recap was already replied for the date
 *      → response { ok:true, skipped:"already-answered" }
 *      → no NEW recap-request rows are created.
 *   3. SEND when neither condition holds:
 *      → response { ok:true, sent:[{recipient, token}, ...] }
 *      → at minimum Mom + Grandma get a row in dailyRecapRequests with
 *        unique tokens and status='sent'.
 *
 * Uses a far-future date so we never collide with real data.
 */

let server: Server;
let baseUrl = "";
const FUTURE_DATE = "2031-07-09"; // a Wednesday

async function cleanFutureDate() {
  const db = (dbMod as any).getDb();
  await db
    .delete(actualAgendaEntries)
    .where(eq(actualAgendaEntries.dateISO, FUTURE_DATE));
  await db
    .delete(dailyRecapRequests)
    .where(eq(dailyRecapRequests.dateISO, FUTURE_DATE));
}

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
  await cleanFutureDate();
});

// Helper: spy on sdk.authenticateRequest to return an authenticated user.
// Push 9 (2026-05-12) tightened the recap-send route auth gate so it
// requires a real authenticated user with role 'user' or 'admin'.
function stubAuth(role: "user" | "admin" = "admin") {
  return vi
    .spyOn(sdk, "authenticateRequest")
    .mockResolvedValue({ id: "test", role } as any);
}

afterAll(async () => {
  vi.restoreAllMocks();
  try {
    await cleanFutureDate();
  } catch {
    /* ignore */
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("/api/scheduled/daily-recap-send cron behavior", () => {
  it("AUTH gate: rejects anonymous POST with 401 and creates 0 recap rows", async () => {
    // CRITICAL: ensure no leftover spy from a previous run leaks in.
    vi.restoreAllMocks();
    await cleanFutureDate();
    // No stubAuth() — anonymous request.
    const r = await fetch(`${baseUrl}/api/scheduled/daily-recap-send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dateISO: FUTURE_DATE }),
    });
    expect(r.status).toBe(401);
    const body: any = await r.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Unauthorized");

    // No recap-request rows created.
    const db = (dbMod as any).getDb();
    const rows = await db
      .select()
      .from(dailyRecapRequests)
      .where(eq(dailyRecapRequests.dateISO, FUTURE_DATE));
    expect(rows.length).toBe(0);
  });

  it("SKIP path: returns skipped='actual-entries-exist' and creates 0 recap rows when the day has actuals", async () => {
    stubAuth();
    await cleanFutureDate();
    // Seed an actual entry for the future date.
    await dbMod.recordActualEntry({
      dateISO: FUTURE_DATE,
      subjectSlug: "math",
      topic: "Adding fractions",
      minutesSpent: 25,
      source: "mom-input",
      notes: "Reagan got all 5 right.",
      createdBy: "test@example.com",
    } as any);

    const r = await fetch(`${baseUrl}/api/scheduled/daily-recap-send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dateISO: FUTURE_DATE }),
    });
    expect(r.status).toBe(200);
    const body: any = await r.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe("actual-entries-exist");
    expect(body.dateISO).toBe(FUTURE_DATE);
    expect(body.actualCount).toBeGreaterThanOrEqual(1);

    // No recap-request rows for this date should exist.
    const db = (dbMod as any).getDb();
    const rows = await db
      .select()
      .from(dailyRecapRequests)
      .where(eq(dailyRecapRequests.dateISO, FUTURE_DATE));
    expect(rows.length).toBe(0);
  });

  it("SEND path: creates recap-request rows for Mom + Grandma with unique tokens and status='sent' when day is empty", async () => {
    stubAuth();
    await cleanFutureDate();

    const r = await fetch(`${baseUrl}/api/scheduled/daily-recap-send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dateISO: FUTURE_DATE }),
    });
    expect(r.status).toBe(200);
    const body: any = await r.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBeUndefined();
    expect(body.dateISO).toBe(FUTURE_DATE);
    expect(Array.isArray(body.sent)).toBe(true);
    expect(body.sent.length).toBeGreaterThanOrEqual(2);

    const recipients = body.sent.map((s: any) => s.recipient);
    expect(recipients).toContain("marcy.spear@gmail.com");
    expect(recipients).toContain("spear.cpt@gmail.com");

    // Tokens are unique
    const tokens = body.sent.map((s: any) => s.token);
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(tokens.length);
    for (const t of tokens) {
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThanOrEqual(16);
    }

    // Real DB rows exist with status='sent'
    const db = (dbMod as any).getDb();
    const rows = await db
      .select()
      .from(dailyRecapRequests)
      .where(eq(dailyRecapRequests.dateISO, FUTURE_DATE));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.status).toBe("sent");
      expect(typeof row.replyToken).toBe("string");
    }
  });

  it("SKIP path: returns skipped='already-answered' and creates 0 NEW recap rows when one row is already replied", async () => {
    stubAuth();
    await cleanFutureDate();

    // First, create a recap-request row directly, then mark it replied.
    const id = await dbMod.createRecapRequest({
      dateISO: FUTURE_DATE,
      sentTo: "marcy.spear@gmail.com",
      replyToken: "tok_already_answered_test_12345678",
    });
    await dbMod.markRecapReplied(id, "Reagan did math and reading.", 2);

    const beforeRows = (await (dbMod as any).getDb()
      .select()
      .from(dailyRecapRequests)
      .where(eq(dailyRecapRequests.dateISO, FUTURE_DATE))) as any[];
    expect(beforeRows.length).toBe(1);

    const r = await fetch(`${baseUrl}/api/scheduled/daily-recap-send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dateISO: FUTURE_DATE }),
    });
    expect(r.status).toBe(200);
    const body: any = await r.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe("already-answered");
    expect(body.dateISO).toBe(FUTURE_DATE);

    // No new rows added
    const afterRows = (await (dbMod as any).getDb()
      .select()
      .from(dailyRecapRequests)
      .where(eq(dailyRecapRequests.dateISO, FUTURE_DATE))) as any[];
    expect(afterRows.length).toBe(1);
  });
});
