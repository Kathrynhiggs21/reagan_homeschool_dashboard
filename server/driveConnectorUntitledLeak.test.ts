/**
 * driveConnectorUntitledLeak.test.ts (v3.26 — 2026-05-31)
 *
 * Belt-and-suspenders coverage for the Untitled-leak detector wired
 * into `applyConnectorReport`. The detector fires whenever the
 * drainer reports a `pushed` or `skipped` outcome whose `driveFileName`
 * matches the v3.25-class bug shape (gws silently dropping a folder
 * body and creating an "Untitled" file at the user's root).
 *
 * Verified properties:
 *   1. `isUntitledLeakName` matches bare "Untitled", "Untitled (n)",
 *      and case/whitespace variants. Rejects normal names.
 *   2. `applyConnectorReport` stamps an `app_settings` row under
 *      `drive.connector.warnings.untitledLeak.<atISO>.<queueId>` for
 *      every leaked outcome.
 *   3. Non-leaked outcomes do NOT stamp warning rows.
 *   4. Warnings are stamped after the queue update, never before — so
 *      a write failure on the warning path can't lose the queue
 *      transition.
 *   5. The detector is a pure side-channel: the returned summary
 *      shape is unchanged.
 */

import { describe, it, expect, vi } from "vitest";
import {
  applyConnectorReport,
  isUntitledLeakName,
  CONNECTOR_WARNING_KEY_PREFIX,
  type ConnectorReport,
  type ConnectorReportDbSurface,
} from "./_lib/driveConnectorPlan";

function makeFluentDb(): {
  db: ConnectorReportDbSurface;
  markDrivePushResultCalls: Array<Record<string, unknown>>;
  setAppSettingCalls: Array<{ key: string; value: string }>;
} {
  const markDrivePushResultCalls: Array<Record<string, unknown>> = [];
  const setAppSettingCalls: Array<{ key: string; value: string }> = [];
  const db: ConnectorReportDbSurface = {
    markDrivePushResult: async (input: Record<string, unknown>) => {
      markDrivePushResultCalls.push({ ...input });
    },
    setAppSetting: async (key: string, value: string) => {
      setAppSettingCalls.push({ key, value });
    },
  } as unknown as ConnectorReportDbSurface;
  return { db, markDrivePushResultCalls, setAppSettingCalls };
}

describe("isUntitledLeakName — name shape detector", () => {
  it("matches bare 'Untitled'", () => {
    expect(isUntitledLeakName("Untitled")).toBe(true);
  });
  it("matches 'Untitled (1)' Drive auto-rename variant", () => {
    expect(isUntitledLeakName("Untitled (1)")).toBe(true);
    expect(isUntitledLeakName("Untitled (42)")).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(isUntitledLeakName("untitled")).toBe(true);
    expect(isUntitledLeakName("UNTITLED")).toBe(true);
    expect(isUntitledLeakName("UnTiTlEd (3)")).toBe(true);
  });
  it("tolerates leading/trailing whitespace", () => {
    expect(isUntitledLeakName("  Untitled  ")).toBe(true);
    expect(isUntitledLeakName("\tUntitled (2)\n")).toBe(true);
  });
  it("does NOT match real document names", () => {
    expect(isUntitledLeakName("Day Log — 2026-05-31.md")).toBe(false);
    expect(isUntitledLeakName("Khan Academy — Map.md")).toBe(false);
    expect(isUntitledLeakName("Untitled Book Notes.md")).toBe(false);
    expect(isUntitledLeakName("My Untitled Project.docx")).toBe(false);
  });
  it("rejects null/undefined/empty", () => {
    expect(isUntitledLeakName(null)).toBe(false);
    expect(isUntitledLeakName(undefined)).toBe(false);
    expect(isUntitledLeakName("")).toBe(false);
    expect(isUntitledLeakName("   ")).toBe(false);
  });
});

describe("applyConnectorReport — Untitled-leak detector (v3.26)", () => {
  const finishedAtISO = "2026-05-31T22:00:00.000Z";
  const byUser = "drainer:test";

  it("stamps a warning when a pushed outcome reports name='Untitled'", async () => {
    const { db, markDrivePushResultCalls, setAppSettingCalls } = makeFluentDb();
    const report: ConnectorReport = {
      protocolVersion: 1,
      finishedAtISO,
      byUser,
      results: [
        {
          id: 9001,
          outcome: "pushed",
          driveFileId: "fileA",
          driveFileName: "Untitled",
        },
      ],
    };

    const summary = await applyConnectorReport(report, { dbOverride: db });

    // Queue update happened normally.
    expect(markDrivePushResultCalls).toHaveLength(1);
    expect(markDrivePushResultCalls[0]).toMatchObject({
      id: 9001,
      status: "pushed",
      driveFileId: "fileA",
    });

    // Warning was stamped under the v3.26 key prefix.
    const warningCalls = setAppSettingCalls.filter((c) =>
      c.key.startsWith(CONNECTOR_WARNING_KEY_PREFIX),
    );
    expect(warningCalls).toHaveLength(1);
    expect(warningCalls[0].key).toBe(
      `${CONNECTOR_WARNING_KEY_PREFIX}${finishedAtISO}.9001`,
    );
    const parsed = JSON.parse(warningCalls[0].value);
    expect(parsed).toMatchObject({
      queueId: 9001,
      driveFileId: "fileA",
      driveFileName: "Untitled",
      outcome: "pushed",
      finishedAtISO,
      byUser,
    });

    // Returned summary is unaffected by the warning side-channel.
    expect(summary).toEqual({ pushed: 1, skipped: 0, failed: 0, scanned: 1 });
  });

  it("stamps a warning when a skipped outcome reports name='Untitled (3)'", async () => {
    const { db, setAppSettingCalls } = makeFluentDb();
    const report: ConnectorReport = {
      protocolVersion: 1,
      finishedAtISO,
      byUser,
      results: [
        {
          id: 9002,
          outcome: "skipped",
          reason: "Dedupe match",
          driveFileId: "fileB",
          driveFileName: "Untitled (3)",
        },
      ],
    };

    await applyConnectorReport(report, { dbOverride: db });

    const warningCalls = setAppSettingCalls.filter((c) =>
      c.key.startsWith(CONNECTOR_WARNING_KEY_PREFIX),
    );
    expect(warningCalls).toHaveLength(1);
    const parsed = JSON.parse(warningCalls[0].value);
    expect(parsed.driveFileName).toBe("Untitled (3)");
    expect(parsed.outcome).toBe("skipped");
  });

  it("does NOT stamp a warning for normal Drive file names", async () => {
    const { db, setAppSettingCalls } = makeFluentDb();
    const report: ConnectorReport = {
      protocolVersion: 1,
      finishedAtISO,
      byUser,
      results: [
        {
          id: 9003,
          outcome: "pushed",
          driveFileId: "fileC",
          driveFileName: "Day Log — 2026-05-31.md",
        },
        {
          id: 9004,
          outcome: "skipped",
          reason: "Dedupe match",
          driveFileId: "fileD",
          driveFileName: "Khan Academy — Map.md",
        },
        {
          id: 9005,
          outcome: "failed",
          error: "some unrelated upload error",
        },
      ],
    };

    await applyConnectorReport(report, { dbOverride: db });

    const warningCalls = setAppSettingCalls.filter((c) =>
      c.key.startsWith(CONNECTOR_WARNING_KEY_PREFIX),
    );
    expect(warningCalls).toHaveLength(0);
  });

  it("does NOT stamp a warning when driveFileName is omitted (back-compat with older drainers)", async () => {
    const { db, setAppSettingCalls } = makeFluentDb();
    const report: ConnectorReport = {
      protocolVersion: 1,
      finishedAtISO,
      byUser,
      results: [
        {
          id: 9006,
          outcome: "pushed",
          driveFileId: "fileE",
          // no driveFileName — old drainers don't emit it
        },
      ],
    };

    await applyConnectorReport(report, { dbOverride: db });

    const warningCalls = setAppSettingCalls.filter((c) =>
      c.key.startsWith(CONNECTOR_WARNING_KEY_PREFIX),
    );
    expect(warningCalls).toHaveLength(0);
  });

  it("stamps one warning per leaked row when multiple leaks happen in one report", async () => {
    const { db, setAppSettingCalls } = makeFluentDb();
    const report: ConnectorReport = {
      protocolVersion: 1,
      finishedAtISO,
      byUser,
      results: [
        {
          id: 9101,
          outcome: "pushed",
          driveFileId: "leakA",
          driveFileName: "Untitled",
        },
        {
          id: 9102,
          outcome: "pushed",
          driveFileId: "leakB",
          driveFileName: "Untitled",
        },
        {
          id: 9103,
          outcome: "pushed",
          driveFileId: "realC",
          driveFileName: "Real File.md",
        },
      ],
    };

    await applyConnectorReport(report, { dbOverride: db });

    const warningCalls = setAppSettingCalls.filter((c) =>
      c.key.startsWith(CONNECTOR_WARNING_KEY_PREFIX),
    );
    expect(warningCalls).toHaveLength(2);
    // Each warning has a unique key that pins the queue id.
    expect(warningCalls.map((c) => c.key).sort()).toEqual([
      `${CONNECTOR_WARNING_KEY_PREFIX}${finishedAtISO}.9101`,
      `${CONNECTOR_WARNING_KEY_PREFIX}${finishedAtISO}.9102`,
    ]);
  });

  it("queue update happens BEFORE warning stamp (truth-of-record ordering)", async () => {
    // Build a db where markDrivePushResult records a tick before
    // setAppSetting does, so we can assert order.
    const ticks: string[] = [];
    const db: ConnectorReportDbSurface = {
      markDrivePushResult: async () => {
        ticks.push("mark");
      },
      setAppSetting: async (key: string) => {
        if (key.startsWith(CONNECTOR_WARNING_KEY_PREFIX)) ticks.push("warn");
        else ticks.push("summary");
      },
    } as unknown as ConnectorReportDbSurface;

    const report: ConnectorReport = {
      protocolVersion: 1,
      finishedAtISO,
      byUser,
      results: [
        {
          id: 9201,
          outcome: "pushed",
          driveFileId: "leakX",
          driveFileName: "Untitled",
        },
      ],
    };

    await applyConnectorReport(report, { dbOverride: db });

    // mark must come before warn must come before summary.
    const markIdx = ticks.indexOf("mark");
    const warnIdx = ticks.indexOf("warn");
    const summaryIdx = ticks.indexOf("summary");
    expect(markIdx).toBeGreaterThanOrEqual(0);
    expect(warnIdx).toBeGreaterThan(markIdx);
    expect(summaryIdx).toBeGreaterThan(warnIdx);
  });

  it("warning-stamping failures do NOT throw out of applyConnectorReport", async () => {
    // A db that throws on every setAppSetting call should still
    // leave the queue update intact and return the summary.
    const markCalls: Array<unknown> = [];
    const db: ConnectorReportDbSurface = {
      markDrivePushResult: async (input: unknown) => {
        markCalls.push(input);
      },
      setAppSetting: async () => {
        throw new Error("simulated appSettings outage");
      },
    } as unknown as ConnectorReportDbSurface;

    const report: ConnectorReport = {
      protocolVersion: 1,
      finishedAtISO,
      byUser,
      results: [
        {
          id: 9301,
          outcome: "pushed",
          driveFileId: "leakY",
          driveFileName: "Untitled",
        },
      ],
    };

    // The function returns a summary even though the warning write
    // (and the run-summary writes) both throw. Queue mark happened.
    const summary = await applyConnectorReport(report, { dbOverride: db });
    expect(summary).toEqual({ pushed: 1, skipped: 0, failed: 0, scanned: 1 });
    expect(markCalls).toHaveLength(1);
  });
});
