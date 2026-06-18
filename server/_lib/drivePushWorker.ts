/**
 * Drive Push Worker — live uploader (credential-gated)
 * ====================================================
 *
 * The dashboard enqueues `drive_push_queue` rows from a dozen places (day
 * logs, recap replies, reference docs, agenda PDFs, worksheets, …). This
 * module is the drainer that actually uploads them to Google Drive.
 *
 * Credential gate (unchanged contract):
 *   - `getDriveCredentialStatus()` is the single source of truth for "do we
 *     have Drive credentials?". It reads only env, never the network.
 *   - `runDrivePushWorker()` / `runDrivePushOnce()` short-circuit with a
 *     `skipped_no_credentials` outcome (and ZERO DB writes) when no
 *     credential is configured — perfectly safe to call from heartbeat today.
 *
 * Live path (active the moment GOOGLE_DRIVE_OAUTH_TOKEN or
 * GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON lands in env):
 *   1. Resolve the row's target Drive folder id:
 *        target → canonical parent folder id (app_settings drive.folder.*)
 *               → named subfolder (getCanonicalSubfolderId, else mkdir-P)
 *               → optional targetSubpath segments (mkdir-P each).
 *      Resolutions are cached for the process lifetime.
 *   2. Name-based dedupe: if a non-trashed child with the same name already
 *      exists in the destination folder, mark the row `skipped`
 *      (`dedupe_hit`) without uploading. (We can't compare the queue's
 *      SHA-256 contentHash against Drive's md5Checksum — different
 *      algorithms — so byte-dedupe stays a queue-side concern in
 *      enqueueDrivePush; here we dedupe on the deterministic dated filename.)
 *   3. Upload: inline `contentText` → text/markdown body; otherwise fetch the
 *      S3 bytes via a freshly-signed URL (storageGetSignedUrl from fileKey,
 *      else the row's stored fileUrl) and stream them up.
 *   4. Persist exactly ONE markDrivePushResult per row. The worker never
 *      throws to the heartbeat caller — per-row failures are recorded as
 *      `failed` with the upstream error message and the loop continues.
 *
 * Testability: all Drive I/O goes through the injectable `DriveClient`
 * interface (see ./driveClient). Unit tests pass a fake client + fake db, so
 * the live logic is exercised without any network or real credentials.
 */

import * as db from "../db";
import type { DrivePushQueueRow } from "../../drizzle/schema";
import { makeRealDriveClient, type DriveClient } from "./driveClient";
import { storageGetSignedUrl } from "../storage";

/* =====================================================================
   Credential gate — single source of truth (UNCHANGED)
   ===================================================================== */

export type DriveCredentialStatus =
  | { kind: "ready"; source: "oauth_token" | "service_account" | "calendar_oauth_token" | "calendar_service_account" }
  | { kind: "not_configured"; reason: string };

function looksLikeServiceAccount(sa: string): boolean {
  // Cheap shape check — don't validate the full JSON here, just confirm it
  // looks like a service-account blob so we don't false-positive on "{}".
  return sa.length > 50 && sa.includes("private_key") && sa.includes("client_email");
}

export function getDriveCredentialStatus(): DriveCredentialStatus {
  const token = (process.env.GOOGLE_DRIVE_OAUTH_TOKEN || "").trim();
  if (token.length > 0) {
    return { kind: "ready", source: "oauth_token" };
  }
  const sa = (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "").trim();
  if (sa.length > 0) {
    if (looksLikeServiceAccount(sa)) {
      return { kind: "ready", source: "service_account" };
    }
    return {
      kind: "not_configured",
      reason: "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is set but malformed (expected a service-account JSON containing 'private_key' and 'client_email').",
    };
  }
  // Fallback (2026-06-18, approved by Katy): reuse the Google CALENDAR
  // credential for Drive when no dedicated Drive credential is set. The
  // service account mints a Drive-scoped token in resolveAccessToken().
  const calSa = (process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON || "").trim();
  if (calSa.length > 0 && looksLikeServiceAccount(calSa)) {
    return { kind: "ready", source: "calendar_service_account" };
  }
  const calToken = (process.env.GOOGLE_CALENDAR_OAUTH_TOKEN || "").trim();
  if (calToken.length > 0) {
    return { kind: "ready", source: "calendar_oauth_token" };
  }
  return {
    kind: "not_configured",
    reason: "No Drive credentials in env. Set GOOGLE_DRIVE_OAUTH_TOKEN or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON (or provide a Google Calendar credential to reuse for Drive).",
  };
}

/* =====================================================================
   Worker outcome shape (UNCHANGED)
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
   Dependency injection seam
   ===================================================================== */

/**
 * The db surface the worker needs. The real `../db` module satisfies this;
 * tests pass a minimal fake. Declaring it explicitly keeps the worker honest
 * about exactly which helpers it touches.
 */
export interface WorkerDeps {
  listPendingDrivePushes(limit: number): Promise<DrivePushQueueRow[]>;
  markDrivePushResult(args: {
    id: number;
    status: "pushed" | "skipped" | "failed";
    driveFileId?: string | null;
    errorMessage?: string | null;
  }): Promise<unknown>;
  getCanonicalParentForRoutable(
    target: any,
  ): Promise<{ slug: any; folderId: string | null }>;
  getCanonicalSubfolderId(parentName: string, subfolderName: string): Promise<string | null>;
  setAppSetting(key: string, value: string | null): Promise<void>;
  CANONICAL_PARENT_NAMES: Record<string, string>;
  DRIVE_FOLDER_NAMES: Record<string, string>;
}

/** Build the default deps object from the real db module. */
function realDeps(): WorkerDeps {
  return {
    listPendingDrivePushes: (limit) => db.listPendingDrivePushes(limit),
    markDrivePushResult: (args) => db.markDrivePushResult(args),
    getCanonicalParentForRoutable: (target) => db.getCanonicalParentForRoutable(target),
    getCanonicalSubfolderId: (p, s) => db.getCanonicalSubfolderId(p, s),
    setAppSetting: (k, v) => db.setAppSetting(k, v),
    CANONICAL_PARENT_NAMES: db.CANONICAL_PARENT_NAMES as any,
    DRIVE_FOLDER_NAMES: db.DRIVE_FOLDER_NAMES as any,
  };
}

export type WorkerOverrides = {
  driveClient?: DriveClient;
  deps?: WorkerDeps;
  /** Fetch bytes for a binary row. Defaults to presigned-S3 fetch. */
  fetchBytes?: (row: DrivePushQueueRow) => Promise<Uint8Array>;
};

const slugify = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_");

/* =====================================================================
   Folder resolution — target → destination Drive folder id (cached)
   ===================================================================== */

/**
 * Resolve (and create if necessary) the Drive folder id a queue row should
 * land in. Caches every resolution in `cache` for the worker run's lifetime
 * so a batch of day logs only hits the Drive list/create endpoints once.
 */
async function resolveDestinationFolderId(
  row: DrivePushQueueRow,
  drive: DriveClient,
  deps: WorkerDeps,
  cache: Map<string, string>,
): Promise<string> {
  const target = String((row as any).targetFolder ?? (row as any).target_folder ?? "reagan");

  // 1) Canonical parent folder id.
  const parent = await deps.getCanonicalParentForRoutable(target);
  if (!parent.folderId) {
    throw new Error(`No canonical parent folder id for target "${target}" (slug ${String(parent.slug)})`);
  }
  let currentId = parent.folderId;

  // 2) Named subfolder under the parent (e.g. "Day Logs"). Empty string =>
  //    file lives directly in the parent (the Inbox catch-all does this).
  const subfolderName = (deps.DRIVE_FOLDER_NAMES[target] ?? "").trim();
  if (subfolderName.length > 0) {
    const parentName = deps.CANONICAL_PARENT_NAMES[String(parent.slug)] ?? String(parent.slug);
    currentId = await ensureChildFolder(
      currentId,
      subfolderName,
      drive,
      cache,
      // Prefer the persisted canonical-subfolder id when we have one; this
      // avoids a list call and keeps us pinned to the folder the dashboard
      // already knows about.
      async () => await deps.getCanonicalSubfolderId(parentName, subfolderName),
      // When we discover/create the id, persist it back so future ticks and
      // other code paths reuse it.
      async (id) => {
        await deps.setAppSetting(`drive.folderMap.${slugify(parentName)}.${slugify(subfolderName)}`, id);
      },
    );
  }

  // 3) Optional structural subpath (e.g. "Math/Graded"). Date-named
  //    artifacts pass an empty subpath (flattened 2026-06-18); classroom
  //    lifecycle + static doc trees still use it.
  const subpath = String((row as any).targetSubpath ?? (row as any).target_subpath ?? "").trim();
  if (subpath.length > 0) {
    for (const seg of subpath.split("/").map((s) => s.trim()).filter(Boolean)) {
      currentId = await ensureChildFolder(currentId, seg, drive, cache);
    }
  }

  return currentId;
}

/**
 * Find-or-create a child folder named `name` under `parentId`. Order:
 *   1. process cache,
 *   2. optional `persistedLookup` (e.g. app_settings cache),
 *   3. live Drive list,
 *   4. create.
 * Persists newly-discovered ids via `onResolve` when provided.
 */
async function ensureChildFolder(
  parentId: string,
  name: string,
  drive: DriveClient,
  cache: Map<string, string>,
  persistedLookup?: () => Promise<string | null>,
  onResolve?: (id: string) => Promise<void>,
): Promise<string> {
  const cacheKey = `${parentId}::${name.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  if (persistedLookup) {
    const persisted = await persistedLookup();
    if (persisted && persisted.length > 0 && !persisted.startsWith("1FAKE")) {
      cache.set(cacheKey, persisted);
      return persisted;
    }
  }

  const children = await drive.listChildren(parentId, { foldersOnly: true });
  const match = children.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  let id: string;
  if (match) {
    id = match.id;
  } else {
    id = await drive.createFolder(parentId, name);
  }
  cache.set(cacheKey, id);
  if (onResolve) {
    try { await onResolve(id); } catch { /* persistence is best-effort */ }
  }
  return id;
}

/* =====================================================================
   Per-row drain
   ===================================================================== */

async function defaultFetchBytes(row: DrivePushQueueRow): Promise<Uint8Array> {
  const directUrl = String((row as any).fileUrl ?? (row as any).file_url ?? "").trim();
  const fileKey = String((row as any).fileKey ?? (row as any).file_key ?? "").trim();
  let url = directUrl;
  // Prefer a freshly-signed URL from the key (the stored fileUrl may be a
  // relative /manus-storage path or an expired signature).
  if (fileKey.length > 0) {
    try {
      url = await storageGetSignedUrl(fileKey);
    } catch {
      // fall back to whatever was stored on the row
    }
  }
  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    throw new Error(`Row ${row.id}: no fetchable URL (fileKey="${fileKey}", fileUrl="${directUrl}")`);
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Row ${row.id}: byte fetch ${resp.status} from storage`);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Drain a single row to completion. Resolves the destination folder, runs
 * name-dedupe, uploads, and records exactly one result. Returns the outcome.
 */
async function drainRow(
  row: DrivePushQueueRow,
  drive: DriveClient,
  deps: WorkerDeps,
  cache: Map<string, string>,
  fetchBytes: (r: DrivePushQueueRow) => Promise<Uint8Array>,
): Promise<"pushed" | "skipped" | "failed"> {
  try {
    const destId = await resolveDestinationFolderId(row, drive, deps, cache);
    const fileName = String((row as any).fileName ?? (row as any).file_name ?? "").trim();
    if (!fileName) throw new Error(`Row ${row.id}: missing fileName`);

    // Name-based dedupe against the destination folder.
    const existing = await drive.listChildren(destId);
    const dupe = existing.find((c) => c.name.trim().toLowerCase() === fileName.toLowerCase());
    if (dupe) {
      await deps.markDrivePushResult({
        id: row.id,
        status: "skipped",
        driveFileId: dupe.id,
        errorMessage: "dedupe_hit",
      });
      return "skipped";
    }

    const contentText = (row as any).contentText ?? (row as any).content_text ?? null;
    const mimeType =
      String((row as any).mimeType ?? (row as any).mime_type ?? "").trim() ||
      (contentText != null ? "text/markdown" : "application/octet-stream");

    let uploaded;
    if (contentText != null && String(contentText).length > 0) {
      uploaded = await drive.uploadFile({
        parentId: destId,
        name: fileName,
        mimeType: mimeType || "text/markdown",
        contentText: String(contentText),
      });
    } else {
      const bytes = await fetchBytes(row);
      uploaded = await drive.uploadFile({
        parentId: destId,
        name: fileName,
        mimeType,
        contentBytes: bytes,
      });
    }

    await deps.markDrivePushResult({
      id: row.id,
      status: "pushed",
      driveFileId: uploaded.id,
      errorMessage: null,
    });
    return "pushed";
  } catch (e: any) {
    await deps.markDrivePushResult({
      id: row.id,
      status: "failed",
      errorMessage: (e?.message ?? String(e)).slice(0, 600),
    });
    return "failed";
  }
}

/* =====================================================================
   Public entry — schedule-safe drain
   ===================================================================== */

/**
 * Drains up to `limit` pending rows. Safe to call from heartbeat: when no
 * credential is configured it short-circuits with `skipped_no_credentials`
 * and zero DB writes.
 */
export async function runDrivePushWorker(
  opts: { limit?: number } & WorkerOverrides = {},
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

  const deps = opts.deps ?? realDeps();
  const drive = opts.driveClient ?? makeRealDriveClient();
  const fetchBytes = opts.fetchBytes ?? defaultFetchBytes;

  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
  const pending = (await deps.listPendingDrivePushes(limit)) as DrivePushQueueRow[];

  const cache = new Map<string, string>();
  let pushed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of pending) {
    const outcome = await drainRow(row, drive, deps, cache, fetchBytes);
    if (outcome === "pushed") pushed += 1;
    else if (outcome === "skipped") skipped += 1;
    else failed += 1;
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
 * Single-row drain used by tests and by the live worker's loop. Same
 * credential gate; returns the same outcome contract as the queue row's
 * eventual status.
 */
export async function runDrivePushOnce(
  row: DrivePushQueueRow,
  overrides: WorkerOverrides = {},
): Promise<{ outcome: "pushed" | "skipped" | "failed" | "skipped_no_credentials"; reason?: string }> {
  const cred = getDriveCredentialStatus();
  if (cred.kind !== "ready") {
    return { outcome: "skipped_no_credentials", reason: cred.reason };
  }
  const deps = overrides.deps ?? realDeps();
  const drive = overrides.driveClient ?? makeRealDriveClient();
  const fetchBytes = overrides.fetchBytes ?? defaultFetchBytes;
  const cache = new Map<string, string>();
  const outcome = await drainRow(row, drive, deps, cache, fetchBytes);
  return { outcome };
}
