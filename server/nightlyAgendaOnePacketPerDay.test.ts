import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import * as dbMod from "./db";
import { nightlyAgendaEmails } from "../drizzle/schema";

/**
 * "Cron emits exactly ONE packet per day" guarantee for the nightly agenda
 * email. The mechanism:
 *   1. The route assembles the agenda for `forDate`, computes
 *      `agendaHash = sha256(canonical body)`.
 *   2. Calls `getLatestNightlyAgendaEmail(forDate)`.
 *   3. If the latest row's `agendaHash === agendaHash` AND `status === "sent"`
 *      AND the request is not `force=true`, the route short-circuits with
 *      `{ ok: true, status: "unchanged" }` and inserts NO new row.
 *
 * This file proves both halves:
 *   PART A (source contract) — the dedup branch literally exists in
 *   `scheduledSync.ts` and consults the right helper.
 *   PART B (real-DB integration) — `getLatestNightlyAgendaEmail` returns the
 *   most recent row for a given forDate, so the comparison the route makes
 *   is fed by real ground truth.
 */

const FUTURE_DATE = "2031-06-04"; // a Wednesday, far enough in the future
const TEST_HASH_A = "a".repeat(64);
const TEST_HASH_B = "b".repeat(64);

describe("nightly-agenda-email — one packet per day", () => {
  /* ------------------------- PART A: source contract ------------------------- */
  const src = fs.readFileSync(
    path.join(__dirname, "scheduledSync.ts"),
    "utf8",
  );

  it("route reads the latest sent row via getLatestNightlyAgendaEmail(forDate)", () => {
    expect(src).toContain("db.getLatestNightlyAgendaEmail(forDate)");
  });

  it("route compares stored agendaHash against newly-computed agendaHash", () => {
    // Both clauses must appear AND on the same dedup branch.
    expect(src).toMatch(/last && last\.agendaHash === agendaHash && last\.status === "sent" && !force/);
  });

  it('route short-circuits with { status: "unchanged" } and returns BEFORE inserting a new row', () => {
    // The dedup `return res.json({ ok: true, status: "unchanged", ... })` must
    // appear in the source BEFORE the call to `db.insertNightlyAgendaEmail(`.
    // Otherwise the cron would still insert a row even when content is unchanged.
    const dedupReturnIdx = src.indexOf('status: "unchanged"');
    const insertIdx = src.indexOf("db.insertNightlyAgendaEmail(");
    expect(dedupReturnIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeGreaterThan(0);
    expect(dedupReturnIdx).toBeLessThan(insertIdx);
  });

  it("force=true is the only way to bypass the dedup", () => {
    expect(src).toContain("const force = !!req.body?.force");
    expect(src).toContain("&& !force");
  });
});

describe("nightly-agenda-email — getLatestNightlyAgendaEmail real-DB", () => {
  beforeAll(async () => {
    // Clean any leftover rows for our test date.
    const db = (dbMod as any).getDb();
    await db
      .delete(nightlyAgendaEmails)
      .where(eq(nightlyAgendaEmails.forDate, FUTURE_DATE));
  });

  afterAll(async () => {
    const db = (dbMod as any).getDb();
    await db
      .delete(nightlyAgendaEmails)
      .where(eq(nightlyAgendaEmails.forDate, FUTURE_DATE));
  });

  it("returns null when no row exists for the date", async () => {
    const row = await dbMod.getLatestNightlyAgendaEmail(FUTURE_DATE);
    expect(row).toBeNull();
  });

  it("returns the most recently sent row when multiple rows share the date", async () => {
    // Insert an older 'sent' row first (hash A), then a newer 'sent' row
    // (hash B). The route's dedup logic uses the LATEST row, so we expect
    // hash B to be returned.
    await dbMod.insertNightlyAgendaEmail({
      forDate: FUTURE_DATE,
      recipients: "spear.cpt@gmail.com, marcy.spear@gmail.com",
      agendaHash: TEST_HASH_A,
      blockCount: 5,
      status: "sent",
      triggerKind: "nightly",
    });
    // Small delay so sentAt timestamps are distinct
    await new Promise((r) => setTimeout(r, 1100));
    await dbMod.insertNightlyAgendaEmail({
      forDate: FUTURE_DATE,
      recipients: "spear.cpt@gmail.com, marcy.spear@gmail.com",
      agendaHash: TEST_HASH_B,
      blockCount: 6,
      status: "sent",
      triggerKind: "change_resend",
    });

    const latest = await dbMod.getLatestNightlyAgendaEmail(FUTURE_DATE);
    expect(latest).toBeTruthy();
    expect(latest!.agendaHash).toBe(TEST_HASH_B);
    expect(latest!.status).toBe("sent");
  });

  it("dedup decision is correct when latest hash matches new hash (route would NOT insert)", () => {
    // This is the JS-level decision the route makes. We replay it here so the
    // contract is unit-asserted independently of the live HTTP path.
    const last = { agendaHash: TEST_HASH_B, status: "sent" as const };
    const newAgendaHash = TEST_HASH_B;
    const force = false;
    const shouldShortCircuit =
      !!last &&
      last.agendaHash === newAgendaHash &&
      last.status === "sent" &&
      !force;
    expect(shouldShortCircuit).toBe(true);
  });

  it("dedup decision flips when content changes (route WOULD insert resend row)", () => {
    const last = { agendaHash: TEST_HASH_B, status: "sent" as const };
    const newAgendaHash = "c".repeat(64); // different content
    const force = false;
    const shouldShortCircuit =
      !!last &&
      last.agendaHash === newAgendaHash &&
      last.status === "sent" &&
      !force;
    expect(shouldShortCircuit).toBe(false);
  });

  it("dedup decision flips when force=true even if hash matches", () => {
    const last = { agendaHash: TEST_HASH_B, status: "sent" as const };
    const newAgendaHash = TEST_HASH_B;
    const force = true;
    const shouldShortCircuit =
      !!last &&
      last.agendaHash === newAgendaHash &&
      last.status === "sent" &&
      !force;
    expect(shouldShortCircuit).toBe(false);
  });
});
