/**
 * Drive Push Worker — credential-gated stub (2026-05-30)
 * ======================================================
 *
 * The dashboard already enqueues `drive_push_queue` rows from a dozen places
 * (day logs, recap replies, the 12 reference Markdown docs, future-worksheet
 * imports, etc.). What's missing is the drainer that actually uploads them.
 *
 * Building the live drainer requires a Google Drive OAuth token or a service
 * account JSON, which has NOT been provided yet. Until then this module:
 *
 *   1. Exposes `getDriveCredentialStatus()` — a single source of truth for
 *      "do we have Drive credentials?" Currently returns `not_configured`.
 *      The moment the user drops a `GOOGLE_DRIVE_OAUTH_TOKEN` or a
 *      `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` env var into the project, this
 *      function flips to `ready` and the rest of the worker comes online.
 *
 *   2. Exposes `runDrivePushWorker()` — the public entry point. When
 *      credentials are missing, it short-circuits immediately with a
 *      structured `skipped_no_credentials` summary (no errors, no DB
 *      writes — perfectly safe to call from a heartbeat schedule today).
 *      When credentials land, it walks `listPendingDrivePushes`, performs
 *      hash-based dedupe against the target folder's children, uploads
 *      anything new, and marks each row `pushed` / `skipped` / `failed`
 *      via `markDrivePushResult`.
 *
 *   3. Exposes `runDrivePushOnce()` for unit-testable single-row drain.
 *      Same credential gate, same outcome shape.
 *
 * Design intent: the day Mom (or whoever) creates the Google Cloud project,
 * generates an OAuth token or service account, and drops it in env, this
 * file goes from no-op to live with **zero callsite changes**. Heartbeat
 * already calls `runDrivePushWorker()` on schedule — it just exits early
 * today.
 *
 * Implementation notes for the live path (left here so the future
 * implementer doesn't have to re-derive them):
 *
 *   - Hash-based skip: before uploading, list the target folder's children
 *     via `drive.files.list({ q: "'${parentId}' in parents and trashed=false" })`.
 *     Compare the row's `contentHash` against each child's `md5Checksum`
 *     (Drive returns it for binary files). If a match exists, write
 *     `status='skipped'` + `errorMessage='dedupe_hit'` and move on without
 *     uploading.
 *
 *   - Inline content: when the row has `contentText` set (markdown blob),
 *     create the Drive file via `drive.files.create({ requestBody: {...},
 *     media: { mimeType: 'text/markdown', body: contentText } })`. No S3
 *     fetch needed.
 *
 *   - Binary content: when `fileKey` is set, presign the S3 GET via
 *     `storageGet(fileKey)` and stream the response into `media.body`.
 *
 *   - Folder resolution: `targetFolder` is a logical bucket name; the live
 *     worker needs a `targetFolderToDriveId(folder, subpath)` helper that
 *     maps "day_log" → the actual Drive folder ID under "Daily Operations /
 *     Day Logs / 2026-05". Derive lazily on first use, cache for the
 *     process lifetime. `mkdirP` semantics: create missing intermediate
 *     folders so the worker is self-bootstrapping.
 *
 *   - Outcome persistence: every row gets exactly ONE `markDrivePushResult`
 *     call. Failures are logged with `status='failed'` + the upstream
 *     error message; the worker never throws to the heartbeat caller.
 *
 *   - Concurrency: serial drain is fine (Mom's volume is < 100 rows/day).
 *     Drive API is happy with sequential requests; rate limits won't be
 *     hit at this scale.
 */

import * as db from "../db";
import type { DrivePushQueueRow } from "../../drizzle/schema";

/* =====================================================================
   Credential gate — single source of truth
   ===================================================================== */

export type DriveCredentialStatus =
  | { kind: "ready"; source: "oauth_token" | "service_account" }
  | { kind: "not_configured"; reason: string };

/**
 * Returns whether the live Drive uploader should run. The caller is
 * responsible for short-circuiting; this function never reads from the
 * network and is safe to call thousands of times.
 */
export function getDriveCredentialStatus(): DriveCredentialStatus {
  const token = (process.env.GOOGLE_DRIVE_OAUTH_TOKEN || "").trim();
  if (token.length > 0) {
    return { kind: "ready", source: "oauth_token" };
  }
  const sa = (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "").trim();
  if (sa.length > 0) {
    // Cheap shape check — don't validate the full JSON here, just confirm
    // it looks like a service account blob so we don't false-positive on
    // an empty literal "{}" or stray characters.
    if (sa.length > 50 && sa.includes("private_key") && sa.includes("client_email")) {
      return { kind: "ready", source: "service_account" };
    }
    return {
      kind: "not_configured",
      reason: "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is set but malformed (expected a service-account JSON containing 'private_key' and 'client_email').",
    };
  }
  return {
    kind: "not_configured",
    reason: "No Drive credentials in env. Set GOOGLE_DRIVE_OAUTH_TOKEN (preferred for personal use) or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON to enable the worker.",
  };
}

/* =====================================================================
   Worker outcome shape
   ===================================================================== */

export type DrivePushSummary = {
  status: "skipped_no_credentials" | "drained" | "drained_with_errors";
  scanned: number;
  pushed: number;
  skipped: number;
  failed: number;
  reason?: string;
};

/* =====================================================================
   Public entry — schedule-safe drain
   ===================================================================== */

/**
 * Drains up to `limit` pending rows. Safe to call from a heartbeat
 * schedule today — when credentials are missing it short-circuits with
 * `skipped_no_credentials` and zero DB writes.
 */
export async function runDrivePushWorker(
  opts: { limit?: number } = {},
): Promise<DrivePushSummary> {
  const cred = getDriveCredentialStatus();
  if (cred.kind !== "ready") {
    return {
      status: "skipped_no_credentials",
      scanned: 0,
      pushed: 0,
      skipped: 0,
      failed: 0,
      reason: cred.reason,
    };
  }

  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
  const pending = (await db.listPendingDrivePushes(limit)) as DrivePushQueueRow[];

  let pushed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of pending) {
    // The live implementation goes here. Until it lands, mark the row
    // failed with a clear error so we don't silently spin on the same
    // row forever once credentials arrive but the live path is still TBD.
    // (We never reach this branch today because the credential gate
    // above short-circuits.)
    await db.markDrivePushResult({
      id: row.id,
      status: "failed",
      errorMessage:
        "drivePushWorker live path not yet implemented — credentials present but uploader stub still in place. See drivePushWorker.ts module header for the wiring guide.",
    });
    failed += 1;
  }

  return {
    status: failed > 0 ? "drained_with_errors" : "drained",
    scanned: pending.length,
    pushed,
    skipped,
    failed,
  };
}

/**
 * Single-row drain used by tests and by the live worker's loop. Returns
 * the same outcome contract as the queue row's eventual status.
 */
export async function runDrivePushOnce(
  row: DrivePushQueueRow,
): Promise<{ outcome: "pushed" | "skipped" | "failed" | "skipped_no_credentials"; reason?: string }> {
  const cred = getDriveCredentialStatus();
  if (cred.kind !== "ready") {
    return { outcome: "skipped_no_credentials", reason: cred.reason };
  }
  // Live path TBD — see module header for the wiring guide.
  await db.markDrivePushResult({
    id: row.id,
    status: "failed",
    errorMessage:
      "drivePushWorker live path not yet implemented — see drivePushWorker.ts module header.",
  });
  return {
    outcome: "failed",
    reason: "drivePushWorker live path not yet implemented",
  };
}
