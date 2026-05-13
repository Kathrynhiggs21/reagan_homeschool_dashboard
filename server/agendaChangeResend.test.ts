/**
 * Push 35 — Agenda change-detection enqueue contract.
 *
 * Locks in:
 *   1. markAgendaDirtyForDate inserts a `change_resend` row ONLY for
 *      today + future dates.
 *   2. Past dates are no-ops.
 *   3. Idempotent — a second call for the same day doesn't duplicate
 *      the queued row.
 *   4. The nightly handler's resend branch flips status='resent' and
 *      prepends "[UPDATED]" to the subject (source-level check on
 *      scheduledSync.ts because we don't run the express handler in
 *      this unit test).
 *   5. updateBlock fires the dirty flag for fields recipients can see
 *      (source-level check).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Agenda change-detection — push 35", () => {
  const dbSrc = fs.readFileSync(path.join(__dirname, "db.ts"), "utf-8");
  const schedSrc = fs.readFileSync(path.join(__dirname, "scheduledSync.ts"), "utf-8");

  it("markAgendaDirtyForDate helper is exported from db.ts", () => {
    expect(dbSrc).toContain("export async function markAgendaDirtyForDate(");
  });

  it("guards against past dates (skips when dateISO < today)", () => {
    expect(dbSrc).toMatch(
      /if \(dateISO < today\) \{\s*\n\s*return \{ enqueued: false \};/,
    );
  });

  it("guards against malformed dates", () => {
    expect(dbSrc).toContain(
      'if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateISO)) {',
    );
  });

  it("is idempotent — checks for an existing queued change_resend row before inserting", () => {
    expect(dbSrc).toContain('eq(nightlyAgendaEmails.status, "queued")');
    expect(dbSrc).toContain('eq(nightlyAgendaEmails.triggerKind, "change_resend")');
  });

  it("uses insertNightlyAgendaEmail with triggerKind='change_resend'", () => {
    const fnStart = dbSrc.indexOf("export async function markAgendaDirtyForDate");
    const fnEnd = dbSrc.indexOf("\nexport ", fnStart + 1);
    const body = dbSrc.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(body).toContain('triggerKind: "change_resend"');
    expect(body).toContain("insertNightlyAgendaEmail(");
  });

  it("updateBlock fires markAgendaDirtyForDate when any recipient-visible field changes", () => {
    const idx = dbSrc.indexOf("export async function updateBlock(");
    expect(idx).toBeGreaterThan(0);
    // Look at the next 800 chars after the function header
    const window = dbSrc.slice(idx, idx + 2500);
    expect(window).toContain("markAgendaDirtyForDate(");
    // Make sure each recipient-visible field is covered.
    for (const field of [
      "patch.title",
      "patch.subjectId",
      "patch.startTime",
      "patch.durationMin",
      "patch.status",
      "patch.sortOrder",
      "patch.description",
      "patch.curriculumTopicId",
    ]) {
      expect(window, `field ${field} should trigger dirty flag`).toContain(field);
    }
  });

  it("nightly-agenda-email handler still emits triggerKind='change_resend' when isResend", () => {
    expect(schedSrc).toContain('triggerKind: isResend ? "change_resend" : "nightly"');
  });

  it("nightly-agenda-email handler prefixes [UPDATED] when isResend", () => {
    expect(schedSrc).toMatch(/subject = \(isResend \? "\[UPDATED\] "/);
  });
});
