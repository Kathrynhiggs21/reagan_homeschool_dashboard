/**
 * driveConnectorPlan.test.ts (v3.21)
 *
 * Pure-helper coverage. No DB. We isolate `buildTargetMap`,
 * `rowToPlanRow`, `assertValidReport`, and `summarizeResults` so they
 * can be unit-tested without spinning up MySQL.
 */

import { describe, it, expect } from "vitest";
import {
  CONNECTOR_PROTOCOL_VERSION,
  CONNECTOR_LAST_RUN_KEYS,
  buildTargetMap,
  rowToPlanRow,
  assertValidReport,
  summarizeResults,
  type ConnectorReportOutcome,
  type ConnectorReport,
} from "./_lib/driveConnectorPlan";
import {
  DRIVE_FOLDER_NAMES,
  DRIVE_TARGET_TO_CANONICAL_PARENT,
  type DrivePushTarget,
  type CanonicalParentSlug,
} from "./db";

const ALL_TARGETS = Object.keys(DRIVE_FOLDER_NAMES) as DrivePushTarget[];
const ALL_SLUGS: CanonicalParentSlug[] = [
  "adminAndHomeschoolRecords",
  "adventuresAndEnrichment",
  "assignmentsAndWork",
  "curriculumAndStandards",
  "dailyOperations",
  "inboxUnsorted",
  "printablesAndResources",
  "progressAndReports",
  "todo",
];

function mkIds(value: string | null): Record<CanonicalParentSlug, string | null> {
  return Object.fromEntries(ALL_SLUGS.map((s) => [s, value])) as Record<
    CanonicalParentSlug,
    string | null
  >;
}

describe("Drive Connector — protocol version", () => {
  it("is the expected current version", () => {
    expect(CONNECTOR_PROTOCOL_VERSION).toBe(1);
  });
  it("exports a stable set of last-run setting keys", () => {
    // If any of these change downstream, the Settings card breaks.
    expect(CONNECTOR_LAST_RUN_KEYS.atISO).toBe("drive.connector.lastRun.atISO");
    expect(CONNECTOR_LAST_RUN_KEYS.pushed).toBe(
      "drive.connector.lastRun.pushed",
    );
    expect(CONNECTOR_LAST_RUN_KEYS.skipped).toBe(
      "drive.connector.lastRun.skipped",
    );
    expect(CONNECTOR_LAST_RUN_KEYS.failed).toBe(
      "drive.connector.lastRun.failed",
    );
    expect(CONNECTOR_LAST_RUN_KEYS.scanned).toBe(
      "drive.connector.lastRun.scanned",
    );
    expect(CONNECTOR_LAST_RUN_KEYS.byUser).toBe(
      "drive.connector.lastRun.byUser",
    );
  });
});

describe("Drive Connector — buildTargetMap", () => {
  it("covers every DrivePushTarget exactly once", () => {
    const ids = mkIds("FAKE_PARENT_ID");
    const map = buildTargetMap(ids);
    expect(Object.keys(map).sort()).toEqual([...ALL_TARGETS].sort());
  });

  it("wires each target to the right canonical parent slug", () => {
    const ids = mkIds("FAKE_PARENT_ID");
    const map = buildTargetMap(ids);
    for (const target of ALL_TARGETS) {
      const expected = DRIVE_TARGET_TO_CANONICAL_PARENT[target];
      expect(map[target].canonicalParent).toBe(expected);
    }
  });

  it("propagates the canonical parent Drive id by slug", () => {
    const ids: Record<CanonicalParentSlug, string | null> = {
      ...mkIds(null),
      adventuresAndEnrichment: "PARENT_ADV_ID",
    };
    const map = buildTargetMap(ids);
    for (const target of ALL_TARGETS) {
      const slug = DRIVE_TARGET_TO_CANONICAL_PARENT[target];
      const expected =
        slug === "adventuresAndEnrichment" ? "PARENT_ADV_ID" : null;
      expect(map[target].canonicalParentDriveId).toBe(expected);
    }
  });

  it("falls back to null when a slug is missing entirely", () => {
    // Simulate the case where appSettings hasn't been seeded yet — the
    // map must still build with all-null IDs and not crash.
    const partial = {
      ...mkIds(null),
      // intentionally drop one key by leaving it null
    };
    const map = buildTargetMap(partial);
    for (const t of ALL_TARGETS) {
      expect(map[t].canonicalParentDriveId).toBeNull();
    }
  });

  it("maps subfolderName to DRIVE_FOLDER_NAMES[target]", () => {
    const ids = mkIds("X");
    const map = buildTargetMap(ids);
    for (const t of ALL_TARGETS) {
      expect(map[t].subfolderName).toBe(DRIVE_FOLDER_NAMES[t]);
    }
  });
});

describe("Drive Connector — rowToPlanRow", () => {
  const baseRow = {
    id: 7,
    fileName: "2026-05-31 - Day Log.md",
    targetFolder: "day_logs",
    contentText: "# Day Log\n",
    mimeType: "text/markdown",
    fileKey: null,
    targetSubpath: null,
    contentHash: "abc123",
    status: "pending",
    enqueuedAt: new Date(),
    pushedAt: null,
    driveFileId: null,
    errorMessage: null,
  } as any;

  it("includes only wire fields", () => {
    const out = rowToPlanRow(baseRow);
    expect(out).toEqual({
      id: 7,
      fileName: "2026-05-31 - Day Log.md",
      mimeType: "text/markdown",
      contentText: "# Day Log\n",
      fileKey: null,
      targetFolder: "day_logs",
      targetSubpath: null,
      contentHash: "abc123",
    });
    // Make sure timestamps / status do not leak
    expect((out as any).enqueuedAt).toBeUndefined();
    expect((out as any).status).toBeUndefined();
  });

  it("normalizes optional nullable fields to null", () => {
    const out = rowToPlanRow({ ...baseRow, mimeType: undefined, fileKey: undefined, contentText: undefined, targetSubpath: undefined, contentHash: undefined });
    expect(out.mimeType).toBeNull();
    expect(out.fileKey).toBeNull();
    expect(out.contentText).toBeNull();
    expect(out.targetSubpath).toBeNull();
    expect(out.contentHash).toBeNull();
  });
});

describe("Drive Connector — summarizeResults", () => {
  it("counts each outcome bucket and total", () => {
    const results: ConnectorReportOutcome[] = [
      { id: 1, outcome: "pushed", driveFileId: "f1" },
      { id: 2, outcome: "pushed", driveFileId: "f2", bytes: 100 },
      { id: 3, outcome: "skipped", reason: "duplicate" },
      { id: 4, outcome: "failed", error: "boom" },
    ];
    expect(summarizeResults(results)).toEqual({
      pushed: 2,
      skipped: 1,
      failed: 1,
      scanned: 4,
    });
  });

  it("returns all-zero with empty results", () => {
    expect(summarizeResults([])).toEqual({
      pushed: 0,
      skipped: 0,
      failed: 0,
      scanned: 0,
    });
  });
});

describe("Drive Connector — assertValidReport", () => {
  function valid(): ConnectorReport {
    return {
      protocolVersion: CONNECTOR_PROTOCOL_VERSION,
      finishedAtISO: "2026-05-31T05:00:00.000Z",
      byUser: "ubuntu",
      results: [
        { id: 1, outcome: "pushed", driveFileId: "abc" },
        { id: 2, outcome: "skipped", reason: "duplicate" },
        { id: 3, outcome: "failed", error: "EAGAIN" },
      ],
    };
  }

  it("accepts a well-formed report", () => {
    expect(() => assertValidReport(valid())).not.toThrow();
  });

  it("rejects null / non-object", () => {
    expect(() => assertValidReport(null)).toThrow(/missing or not an object/);
    expect(() => assertValidReport(42 as any)).toThrow(/missing or not an object/);
  });

  it("rejects mismatched protocol version with a guidance message", () => {
    const r = { ...valid(), protocolVersion: 999 } as any;
    expect(() => assertValidReport(r)).toThrow(/protocol version mismatch/);
    expect(() => assertValidReport(r)).toThrow(
      /scripts\/drive-connector-drainer\.mjs/,
    );
  });

  it("rejects missing finishedAtISO / byUser / results", () => {
    expect(() => assertValidReport({ ...valid(), finishedAtISO: "" })).toThrow(
      /finishedAtISO/,
    );
    expect(() => assertValidReport({ ...valid(), byUser: "" })).toThrow(/byUser/);
    expect(() =>
      assertValidReport({ ...valid(), results: undefined } as any),
    ).toThrow(/results array/);
  });

  it("rejects pushed without driveFileId", () => {
    const r = valid();
    (r.results[0] as any).driveFileId = "";
    expect(() => assertValidReport(r)).toThrow(/missing driveFileId/);
  });

  it("rejects skipped without reason", () => {
    const r = valid();
    (r.results[1] as any).reason = undefined;
    expect(() => assertValidReport(r)).toThrow(/missing reason/);
  });

  it("rejects failed without error", () => {
    const r = valid();
    (r.results[2] as any).error = undefined;
    expect(() => assertValidReport(r)).toThrow(/missing error/);
  });

  it("rejects unknown outcome label", () => {
    const r = valid();
    (r.results[0] as any).outcome = "weird";
    expect(() => assertValidReport(r)).toThrow(/unknown outcome/);
  });

  it("rejects non-numeric id", () => {
    const r = valid();
    (r.results[0] as any).id = "5";
    expect(() => assertValidReport(r)).toThrow(/missing numeric id/);
  });
});
