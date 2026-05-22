/**
 * nightlyAgendaEmailDispatch.test.ts — v2.86 (2026-05-21)
 *
 * Mom reported on 2026-05-21: "no emails sent". Root cause was the
 * heartbeat playbook never POSTing back to /result, so rows stayed at
 * status='queued' forever and gmail MCP never fired. Fix landed in v2.85
 * (rewritten playbook). This test locks the dispatch contract so the
 * regression can't sneak back.
 *
 * PART A (source contract):
 *   - The nightly endpoint MUST return `recordId` so the worker can call /result
 *   - /result MUST accept { recordId, status, errorMessage, drivePushed }
 *   - Status default is "sent"; "failed" and "resent" are honored
 *
 * PART B (real-DB integration):
 *   - Insert a queued row → mark sent → row flips status='sent'
 *   - Insert a queued row → mark failed → row flips status='failed' + errorMessage stored
 *   - drivePushed flag round-trips
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import * as dbMod from "./db";
import { nightlyAgendaEmails } from "../drizzle/schema";

const TEST_DATE = "2031-07-04"; // far-future to avoid colliding with real data
const HASH_X = "x".repeat(64);

describe("nightly-agenda-email — dispatch contract (PART A: source)", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "scheduledSync.ts"),
    "utf8",
  );

  it("nightly endpoint inserts a queued row and returns its recordId", () => {
    expect(src).toMatch(/const recordId = await db\.insertNightlyAgendaEmail\(/);
    // Response shape includes recordId so the worker can call /result.
    expect(src).toMatch(/recordId,/);
  });

  it("/result endpoint accepts { recordId, status, errorMessage, drivePushed }", () => {
    expect(src).toContain(
      'const { recordId, status, errorMessage, drivePushed } = req.body',
    );
  });

  it("/result rejects requests without a numeric recordId", () => {
    expect(src).toContain(
      'if (typeof recordId !== "number") return res.status(400).json({ ok: false, error: "Expected { recordId }" })',
    );
  });

  it("/result default status is 'sent', honors 'failed' and 'resent'", () => {
    expect(src).toMatch(
      /finalStatus: "sent" \| "failed" \| "resent" = status === "failed" \? "failed" : status === "resent" \? "resent" : "sent"/,
    );
  });

  it("/result calls markNightlyAgendaEmailStatus with the resolved status + flags", () => {
    expect(src).toContain("await db.markNightlyAgendaEmailStatus({");
    expect(src).toContain("id: recordId,");
    expect(src).toContain("status: finalStatus,");
    expect(src).toContain("errorMessage: errorMessage ?? null,");
    expect(src).toContain("drivePushed: drivePushed === true,");
  });

  it("/result endpoint is auth-gated (user or admin role required)", () => {
    // Find the /result route block, then confirm the role check appears
    // before db.markNightlyAgendaEmailStatus.
    const resultIdx = src.indexOf(
      '"/api/scheduled/nightly-agenda-email/result"',
    );
    expect(resultIdx).toBeGreaterThan(0);
    const slice = src.slice(resultIdx, resultIdx + 1500);
    expect(slice).toContain('role !== "user"');
    expect(slice).toContain('role !== "admin"');
    const markIdx = slice.indexOf("markNightlyAgendaEmailStatus");
    const checkIdx = slice.indexOf('role !== "admin"');
    expect(checkIdx).toBeLessThan(markIdx);
  });
});

describe("nightly-agenda-email — dispatch contract (PART B: real DB)", () => {
  beforeAll(async () => {
    const db = (dbMod as any).getDb();
    await db
      .delete(nightlyAgendaEmails)
      .where(eq(nightlyAgendaEmails.forDate, TEST_DATE));
  });

  afterAll(async () => {
    const db = (dbMod as any).getDb();
    await db
      .delete(nightlyAgendaEmails)
      .where(eq(nightlyAgendaEmails.forDate, TEST_DATE));
  });

  it("queued row → markNightlyAgendaEmailStatus(sent) flips to sent", async () => {
    const recordId = await dbMod.insertNightlyAgendaEmail({
      forDate: TEST_DATE,
      recipients: "spear.cpt@gmail.com",
      agendaHash: HASH_X,
      blockCount: 5,
      status: "queued",
      triggerKind: "nightly",
    });
    expect(typeof recordId).toBe("number");

    await dbMod.markNightlyAgendaEmailStatus({
      id: recordId as number,
      status: "sent",
      errorMessage: null,
      drivePushed: false,
    });

    const latest = await dbMod.getLatestNightlyAgendaEmail(TEST_DATE);
    expect(latest).toBeTruthy();
    expect(latest!.id).toBe(recordId);
    expect(latest!.status).toBe("sent");
  });

  it("queued row → markNightlyAgendaEmailStatus(failed, errorMessage) records failure", async () => {
    const db = (dbMod as any).getDb();
    // Clean again for this isolated assertion.
    await db
      .delete(nightlyAgendaEmails)
      .where(eq(nightlyAgendaEmails.forDate, TEST_DATE));

    const recordId = await dbMod.insertNightlyAgendaEmail({
      forDate: TEST_DATE,
      recipients: "spear.cpt@gmail.com",
      agendaHash: HASH_X,
      blockCount: 5,
      status: "queued",
      triggerKind: "nightly",
    });

    await dbMod.markNightlyAgendaEmailStatus({
      id: recordId as number,
      status: "failed",
      errorMessage: "gmail MCP timed out",
      drivePushed: false,
    });

    const latest = await dbMod.getLatestNightlyAgendaEmail(TEST_DATE);
    expect(latest).toBeTruthy();
    expect(latest!.status).toBe("failed");
    expect(String(latest!.errorMessage ?? "")).toContain("gmail MCP timed out");
  });

  it("drivePushed=true round-trips through markNightlyAgendaEmailStatus", async () => {
    const db = (dbMod as any).getDb();
    await db
      .delete(nightlyAgendaEmails)
      .where(eq(nightlyAgendaEmails.forDate, TEST_DATE));

    const recordId = await dbMod.insertNightlyAgendaEmail({
      forDate: TEST_DATE,
      recipients: "spear.cpt@gmail.com",
      agendaHash: HASH_X,
      blockCount: 5,
      status: "queued",
      triggerKind: "nightly",
    });

    await dbMod.markNightlyAgendaEmailStatus({
      id: recordId as number,
      status: "sent",
      errorMessage: null,
      drivePushed: true,
    });

    const latest = await dbMod.getLatestNightlyAgendaEmail(TEST_DATE);
    expect(latest).toBeTruthy();
    expect(latest!.status).toBe("sent");
    // drivePushed is the canonical boolean column; some adapters return 1/0
    expect(Boolean(latest!.drivePushed)).toBe(true);
  });
});
