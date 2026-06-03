/**
 * connectorFailureNotify.test.ts (v3.30, 2026-06-02)
 *
 * Locks the owner-failure-alert contract added to `applyConnectorReport`:
 *
 *   - When a drain reports >=1 failed row, notifyOwner is called exactly
 *     once with a title that names the failure count and a body that lists
 *     the failing row ids + their error messages.
 *   - A clean run (0 failed) never notifies.
 *   - Re-applying the SAME report (same finishedAtISO) does not double-send
 *     once the dedupe marker is stamped.
 *   - The dedupe marker is only stamped when notifyOwner returns true, so a
 *     transient outage retries on the next drain.
 *   - The listed-failures body is capped so a mass-failure run can't produce
 *     an unbounded email.
 *
 * Uses the injectable `dbOverride` + `notifyOwner` hooks so the test needs
 * neither a live DB nor the mail transport.
 */

import { describe, it, expect, vi } from "vitest";
import {
  applyConnectorReport,
  CONNECTOR_FAILURE_NOTIFIED_PREFIX,
  type ConnectorReport,
  type ConnectorReportOutcome,
  type ConnectorReportDbSurface,
} from "./_lib/driveConnectorPlan";

/**
 * A tiny in-memory app_settings + markDrivePushResult fake that satisfies
 * the ConnectorReportDbSurface the report applier needs.
 */
function makeFakeDb() {
  const settings = new Map<string, string | null>();
  const marked: Array<{ id: number; status: string }> = [];
  const surface: ConnectorReportDbSurface = {
    async markDrivePushResult(args: any) {
      marked.push({ id: args.id, status: args.status });
    },
    async setAppSetting(key: string, value: string | null) {
      settings.set(key, value);
    },
    async getAppSetting(key: string) {
      return settings.has(key) ? (settings.get(key) ?? null) : null;
    },
  };
  return { surface, settings, marked };
}

function report(
  results: ConnectorReportOutcome[],
  finishedAtISO = "2026-06-02T11:30:00.000Z",
): ConnectorReport {
  return {
    protocolVersion: 1,
    finishedAtISO,
    byUser: "spear.cpt@gmail.com",
    results,
  };
}

describe("applyConnectorReport — owner failure alert (v3.30)", () => {
  it("notifies the owner once when there are failed rows", async () => {
    const { surface } = makeFakeDb();
    const notify = vi.fn(async () => true);
    const summary = await applyConnectorReport(
      report([
        { id: 1, outcome: "pushed", driveFileId: "f1" },
        { id: 2, outcome: "failed", error: "EACCES writing to Drive" },
        { id: 3, outcome: "skipped", reason: "duplicate" },
        { id: 4, outcome: "failed", error: "folder resolve timeout" },
      ]),
      { dbOverride: surface, notifyOwner: notify },
    );

    expect(summary).toEqual({ pushed: 1, skipped: 1, failed: 2, scanned: 4 });
    expect(notify).toHaveBeenCalledTimes(1);

    const arg = notify.mock.calls[0][0];
    expect(arg.title).toContain("2 failed");
    // Body must enumerate the failing rows + their errors.
    expect(arg.content).toContain("#2");
    expect(arg.content).toContain("EACCES writing to Drive");
    expect(arg.content).toContain("#4");
    expect(arg.content).toContain("folder resolve timeout");
    // It should NOT list the pushed/skipped row ids as failures.
    expect(arg.content).not.toContain("#1:");
    expect(arg.content).not.toContain("#3:");
  });

  it("does not notify on a clean run (0 failed)", async () => {
    const { surface } = makeFakeDb();
    const notify = vi.fn(async () => true);
    await applyConnectorReport(
      report([
        { id: 1, outcome: "pushed", driveFileId: "f1" },
        { id: 2, outcome: "skipped", reason: "duplicate" },
      ]),
      { dbOverride: surface, notifyOwner: notify },
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it("de-dupes: re-applying the same report does not double-send", async () => {
    const { surface } = makeFakeDb();
    const notify = vi.fn(async () => true);
    const r = report([{ id: 9, outcome: "failed", error: "boom" }]);

    await applyConnectorReport(r, { dbOverride: surface, notifyOwner: notify });
    await applyConnectorReport(r, { dbOverride: surface, notifyOwner: notify });

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("stamps the dedupe marker keyed by finishedAtISO only after success", async () => {
    const { surface, settings } = makeFakeDb();
    const notify = vi.fn(async () => true);
    const finishedAtISO = "2026-06-02T12:00:00.000Z";
    await applyConnectorReport(
      report([{ id: 5, outcome: "failed", error: "x" }], finishedAtISO),
      { dbOverride: surface, notifyOwner: notify },
    );
    expect(settings.get(`${CONNECTOR_FAILURE_NOTIFIED_PREFIX}${finishedAtISO}`)).toBe(
      finishedAtISO,
    );
  });

  it("does NOT stamp the marker when notifyOwner returns false (retries next drain)", async () => {
    const { surface, settings } = makeFakeDb();
    const notify = vi.fn(async () => false); // transient outage
    const finishedAtISO = "2026-06-02T13:00:00.000Z";
    const r = report([{ id: 6, outcome: "failed", error: "y" }], finishedAtISO);

    await applyConnectorReport(r, { dbOverride: surface, notifyOwner: notify });
    expect(settings.has(`${CONNECTOR_FAILURE_NOTIFIED_PREFIX}${finishedAtISO}`)).toBe(
      false,
    );

    // Next drain with the same run id retries the notification.
    await applyConnectorReport(r, { dbOverride: surface, notifyOwner: notify });
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("caps the listed failures so a mass-failure run stays bounded", async () => {
    const { surface } = makeFakeDb();
    const notify = vi.fn(async () => true);
    const many: ConnectorReportOutcome[] = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      outcome: "failed" as const,
      error: `err-${i + 1}`,
    }));
    await applyConnectorReport(report(many), {
      dbOverride: surface,
      notifyOwner: notify,
    });
    const body = notify.mock.calls[0][0].content;
    expect(body).toContain("40 failed");
    // Capped at 15 listed + an "and N more" line.
    expect(body).toContain("and 25 more");
    // The 16th id should not be individually listed.
    expect(body).not.toContain("#16:");
  });

  it("never throws even if notifyOwner rejects (best-effort)", async () => {
    const { surface, marked } = makeFakeDb();
    const notify = vi.fn(async () => {
      throw new Error("mail transport down");
    });
    await expect(
      applyConnectorReport(report([{ id: 1, outcome: "failed", error: "z" }]), {
        dbOverride: surface,
        notifyOwner: notify,
      }),
    ).resolves.toEqual({ pushed: 0, skipped: 0, failed: 1, scanned: 1 });
    // The queue write is the truth-of-record and still happened.
    expect(marked).toEqual([{ id: 1, status: "failed" }]);
  });
});
