/**
 * Drive Connector Plan / Report (v3.21, 2026-05-31)
 * =================================================
 *
 * Why this exists
 * ---------------
 * The OAuth path for the Drive push worker is blocked behind Google's
 * Cloud-Console+OAuth-playground gauntlet (see runbook
 * `google-drive-oauth-setup`). Mom doesn't want to do that today.
 *
 * The Manus sandbox already has a working `gws` CLI authenticated as
 * `spear.cpt@gmail.com`, so we can drain the queue from a sandbox-side
 * script instead. To keep the production Cloud Run runtime free of any
 * `gws` dependency, the dashboard's role is split in two:
 *
 *   1. **Plan** — `buildConnectorPlan()` reads `drive_push_queue` and
 *      returns the rows the drainer should process, plus the canonical
 *      Hub folder map the drainer needs to know where to land each one.
 *      Pure server-side, no network. Production-safe.
 *
 *   2. **Report** — `applyConnectorReport()` accepts the drainer's outcome
 *      list (per-row pushed/skipped/failed + driveFileId/error) and
 *      writes them back via `db.markDrivePushResult()`. Also captures a
 *      session-summary in `appSettings` (`drive.connector.lastRun.*`) so
 *      the Settings card has a "last run at … pushed N, skipped M,
 *      failed K" line.
 *
 * The actual `gws` calls live in `scripts/drive-connector-drainer.mjs`
 * which is *not* shipped to Cloud Run — it runs from the Manus sandbox
 * shell only.
 *
 * Pure-logic helpers in this module are unit-tested in
 * `server/driveConnectorPlan.test.ts`. The DB-touching helpers
 * (`buildConnectorPlan`, `applyConnectorReport`) are integration-tested
 * with a real test DB in `server/driveConnectorPlanDb.test.ts`.
 *
 * Wire format
 * -----------
 * The plan/report shapes are versioned with `protocolVersion` so the
 * sandbox script and the dashboard server can drift safely if either
 * upgrades first. Bump `CONNECTOR_PROTOCOL_VERSION` whenever you change
 * either shape, and reject mismatched reports.
 */

import * as db from "../db";
import {
  DRIVE_FOLDER_NAMES,
  DRIVE_TARGET_TO_CANONICAL_PARENT,
  type CanonicalParentSlug,
  type DrivePushTarget,
} from "../db";
import type { DrivePushQueueRow } from "../../drizzle/schema";

/* =====================================================================
   Wire-protocol version
   ===================================================================== */

/**
 * Drainer / dashboard handshake version. Bump on every breaking change.
 *   v1 (2026-05-31) — initial wire format.
 */
export const CONNECTOR_PROTOCOL_VERSION = 1 as const;

/* =====================================================================
   Settings keys we use for "last run" surface
   ===================================================================== */

export const CONNECTOR_LAST_RUN_KEYS = {
  atISO: "drive.connector.lastRun.atISO",
  pushed: "drive.connector.lastRun.pushed",
  skipped: "drive.connector.lastRun.skipped",
  failed: "drive.connector.lastRun.failed",
  scanned: "drive.connector.lastRun.scanned",
  byUser: "drive.connector.lastRun.byUser",
} as const;

/* =====================================================================
   Plan — what the drainer needs to do its job
   ===================================================================== */

/**
 * The Hub folder hierarchy that lives under the user's Reagan School Hub
 * root. The drainer uses the canonical parent ID to mkdir-p the
 * subfolder by name, then drops the file under it.
 *
 * The folder map mirrors `db.DRIVE_TARGET_TO_CANONICAL_PARENT` and
 * `db.DRIVE_FOLDER_NAMES` so the drainer doesn't need to import from
 * `db.ts` (which would pull in the mysql driver). We embed the mapping
 * inline at plan-build time.
 */
export type ConnectorTargetMap = Record<
  DrivePushTarget,
  {
    /** Canonical Hub-root logical bucket. */
    canonicalParent: CanonicalParentSlug;
    /** Canonical Hub-root Drive folder ID (resolved from appSettings). */
    canonicalParentDriveId: string | null;
    /** Subfolder name under the canonical parent (may be ""). */
    subfolderName: string;
  }
>;

export type ConnectorPlanRow = {
  id: number;
  fileName: string;
  mimeType: string | null;
  /** Inline content (Markdown / CSV) — null when the row is binary. */
  contentText: string | null;
  /** S3 key for binary rows — null when the row is inline-content. */
  fileKey: string | null;
  /** Logical Hub bucket. The drainer uses targetMap[target] to find the parent. */
  targetFolder: DrivePushTarget;
  /** Optional sub-subfolder under the bucket (e.g. "2026-05" for month bucketing). */
  targetSubpath: string | null;
  /** SHA-256 hex of the bytes the dashboard intends to upload, for hash-skip. */
  contentHash: string | null;
};

export type ConnectorPlan = {
  protocolVersion: typeof CONNECTOR_PROTOCOL_VERSION;
  generatedAtISO: string;
  /** Logical hub label → canonical parent + drive id + subfolder name. */
  targetMap: ConnectorTargetMap;
  rows: ConnectorPlanRow[];
};

/* =====================================================================
   Report — what the drainer sends back after a pass
   ===================================================================== */

export type ConnectorReportOutcome =
  | { id: number; outcome: "pushed"; driveFileId: string; bytes?: number }
  | { id: number; outcome: "skipped"; reason: string; driveFileId?: string }
  | { id: number; outcome: "failed"; error: string };

export type ConnectorReport = {
  protocolVersion: typeof CONNECTOR_PROTOCOL_VERSION;
  finishedAtISO: string;
  byUser: string;
  results: ConnectorReportOutcome[];
};

/* =====================================================================
   Pure helpers (unit-tested without a DB)
   ===================================================================== */

/**
 * Build the per-target folder map from the plain DB constants + the
 * resolved canonical-parent IDs. Pure function — no DB calls, easy to
 * test. The caller owns fetching the canonical IDs out of appSettings.
 */
export function buildTargetMap(
  canonicalParentDriveIds: Record<CanonicalParentSlug, string | null>,
): ConnectorTargetMap {
  const map = {} as ConnectorTargetMap;
  for (const target of Object.keys(DRIVE_FOLDER_NAMES) as DrivePushTarget[]) {
    const canonicalParent = DRIVE_TARGET_TO_CANONICAL_PARENT[target];
    map[target] = {
      canonicalParent,
      canonicalParentDriveId: canonicalParentDriveIds[canonicalParent] ?? null,
      subfolderName: DRIVE_FOLDER_NAMES[target] ?? "",
    };
  }
  return map;
}

/**
 * Slim a queue row down to the wire shape the drainer needs. Drops
 * timestamps, status, dedupeOutcome — the drainer doesn't need them and
 * we don't want to leak them across the trust boundary unnecessarily.
 */
export function rowToPlanRow(row: DrivePushQueueRow): ConnectorPlanRow {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType ?? null,
    contentText: row.contentText ?? null,
    fileKey: row.fileKey ?? null,
    targetFolder: row.targetFolder as DrivePushTarget,
    targetSubpath: row.targetSubpath ?? null,
    contentHash: row.contentHash ?? null,
  };
}

/**
 * Validate an incoming `ConnectorReport`. Throws with a human-readable
 * message on the first violation. Used by the tRPC procedure to reject
 * stale-protocol or malformed reports cleanly.
 */
export function assertValidReport(
  raw: unknown,
): asserts raw is ConnectorReport {
  if (!raw || typeof raw !== "object") {
    throw new Error("Connector report missing or not an object");
  }
  const r = raw as Partial<ConnectorReport>;
  if (r.protocolVersion !== CONNECTOR_PROTOCOL_VERSION) {
    throw new Error(
      `Connector protocol version mismatch — drainer sent v${String(
        r.protocolVersion,
      )}, server expected v${CONNECTOR_PROTOCOL_VERSION}. Update scripts/drive-connector-drainer.mjs to match.`,
    );
  }
  if (typeof r.finishedAtISO !== "string" || !r.finishedAtISO) {
    throw new Error("Connector report missing finishedAtISO");
  }
  if (typeof r.byUser !== "string" || !r.byUser) {
    throw new Error("Connector report missing byUser");
  }
  if (!Array.isArray(r.results)) {
    throw new Error("Connector report missing results array");
  }
  for (let i = 0; i < r.results.length; i += 1) {
    const res = r.results[i];
    if (!res || typeof res !== "object") {
      throw new Error(`Result #${i} not an object`);
    }
    const o = res as ConnectorReportOutcome;
    if (typeof (o as any).id !== "number") {
      throw new Error(`Result #${i} missing numeric id`);
    }
    switch (o.outcome) {
      case "pushed":
        if (typeof o.driveFileId !== "string" || !o.driveFileId) {
          throw new Error(`Pushed result for id=${o.id} missing driveFileId`);
        }
        break;
      case "skipped":
        if (typeof (o as any).reason !== "string") {
          throw new Error(`Skipped result for id=${o.id} missing reason`);
        }
        break;
      case "failed":
        if (typeof (o as any).error !== "string") {
          throw new Error(`Failed result for id=${o.id} missing error`);
        }
        break;
      default:
        throw new Error(
          `Result #${i} has unknown outcome "${String((o as any).outcome)}"`,
        );
    }
  }
}

/**
 * Pure: summarize a results array into the counts we want to surface in
 * the Settings card.
 */
export function summarizeResults(results: ConnectorReportOutcome[]): {
  pushed: number;
  skipped: number;
  failed: number;
  scanned: number;
} {
  let pushed = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of results) {
    if (r.outcome === "pushed") pushed += 1;
    else if (r.outcome === "skipped") skipped += 1;
    else if (r.outcome === "failed") failed += 1;
  }
  return { pushed, skipped, failed, scanned: results.length };
}

/* =====================================================================
   DB-touching helpers
   ===================================================================== */

const ALL_CANONICAL_SLUGS: CanonicalParentSlug[] = [
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

/**
 * Build the connector plan from the DB. Reads the 9 canonical-parent
 * Drive IDs from `appSettings`, then pulls up to `limit` pending rows
 * via `listPendingDrivePushes`. Returns the wire payload the drainer
 * script will consume.
 *
 * Best-effort across canonical IDs: if appSettings is missing one of
 * the 9 keys, the corresponding `canonicalParentDriveId` is null and
 * the drainer must skip rows that resolve to it. We don't want to
 * throw here — Mom can have one bucket misconfigured without us
 * blocking the rest of the queue.
 */
export async function buildConnectorPlan(
  opts: { limit?: number } = {},
): Promise<ConnectorPlan> {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));

  // Fetch all 9 canonical IDs in one batched read. `listAppSettings`
  // doesn't take a wildcard prefix that matches our keys exactly so we
  // pull the whole `drive.folder.` namespace.
  const allSettings = await db.listAppSettings("drive.folder.");
  const canonicalParentDriveIds: Record<CanonicalParentSlug, string | null> = {
    adminAndHomeschoolRecords: null,
    adventuresAndEnrichment: null,
    assignmentsAndWork: null,
    curriculumAndStandards: null,
    dailyOperations: null,
    inboxUnsorted: null,
    printablesAndResources: null,
    progressAndReports: null,
    todo: null,
  };
  for (const slug of ALL_CANONICAL_SLUGS) {
    const row = allSettings.find((r) => r.key === `drive.folder.${slug}`);
    if (row && row.value && row.value.length > 0) {
      canonicalParentDriveIds[slug] = row.value;
    }
  }

  const rows = (await db.listPendingDrivePushes(limit)) as DrivePushQueueRow[];
  return {
    protocolVersion: CONNECTOR_PROTOCOL_VERSION,
    generatedAtISO: new Date().toISOString(),
    targetMap: buildTargetMap(canonicalParentDriveIds),
    rows: rows.map(rowToPlanRow),
  };
}

/**
 * Apply a drainer report to the DB. Each result becomes exactly one
 * `markDrivePushResult` call. Then we stamp the run summary into
 * appSettings so the Settings card can render "Last run: …".
 *
 * Returns the same summary so the caller can show it in the response.
 */
export async function applyConnectorReport(
  report: ConnectorReport,
): Promise<{
  pushed: number;
  skipped: number;
  failed: number;
  scanned: number;
}> {
  // Validate first — if anything throws we don't write any partial state.
  assertValidReport(report);

  for (const r of report.results) {
    if (r.outcome === "pushed") {
      await db.markDrivePushResult({
        id: r.id,
        status: "pushed",
        driveFileId: r.driveFileId,
        errorMessage: null,
      });
    } else if (r.outcome === "skipped") {
      await db.markDrivePushResult({
        id: r.id,
        status: "skipped",
        driveFileId: r.driveFileId ?? null,
        errorMessage: r.reason,
      });
    } else {
      await db.markDrivePushResult({
        id: r.id,
        status: "failed",
        driveFileId: null,
        errorMessage: r.error,
      });
    }
  }

  const summary = summarizeResults(report.results);

  // Stamp the run summary in appSettings. Each is a separate setAppSetting
  // call so the Settings card can read individual keys. Best-effort:
  // failures here don't throw because the queue updates above are the
  // truth-of-record.
  try {
    await db.setAppSetting(CONNECTOR_LAST_RUN_KEYS.atISO, report.finishedAtISO);
    await db.setAppSetting(
      CONNECTOR_LAST_RUN_KEYS.pushed,
      String(summary.pushed),
    );
    await db.setAppSetting(
      CONNECTOR_LAST_RUN_KEYS.skipped,
      String(summary.skipped),
    );
    await db.setAppSetting(
      CONNECTOR_LAST_RUN_KEYS.failed,
      String(summary.failed),
    );
    await db.setAppSetting(
      CONNECTOR_LAST_RUN_KEYS.scanned,
      String(summary.scanned),
    );
    await db.setAppSetting(CONNECTOR_LAST_RUN_KEYS.byUser, report.byUser);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[driveConnectorPlan] failed to stamp run summary", e);
  }

  return summary;
}

/**
 * Read the last-run summary from appSettings. Returns null fields when
 * the connector has never run. Used by the Settings card.
 */
export async function readLastConnectorRun(): Promise<{
  atISO: string | null;
  pushed: number | null;
  skipped: number | null;
  failed: number | null;
  scanned: number | null;
  byUser: string | null;
}> {
  const all = await db.listAppSettings("drive.connector.lastRun.");
  const get = (k: string) => all.find((r) => r.key === k)?.value ?? null;
  const num = (k: string) => {
    const v = get(k);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    atISO: get(CONNECTOR_LAST_RUN_KEYS.atISO),
    pushed: num(CONNECTOR_LAST_RUN_KEYS.pushed),
    skipped: num(CONNECTOR_LAST_RUN_KEYS.skipped),
    failed: num(CONNECTOR_LAST_RUN_KEYS.failed),
    scanned: num(CONNECTOR_LAST_RUN_KEYS.scanned),
    byUser: get(CONNECTOR_LAST_RUN_KEYS.byUser),
  };
}
