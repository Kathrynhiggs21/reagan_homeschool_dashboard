/**
 * Drive Folder Dedupe Job — credential-gated stub (2026-05-30)
 * ============================================================
 *
 * Single module that handles three closely-related Drive-side
 * housekeeping jobs once Drive credentials are available:
 *
 *   1. **Orphan / dupe cleanup** — find empty folders under the canonical
 *      parents and trash them (never permanently delete). Skips the 9
 *      pinned top-level Hub folders.
 *
 *   2. **Hash-based skip** — exposed as `findHashDuplicate(parentId,
 *      contentHash)` so the push worker can call it BEFORE uploading.
 *      Returns the existing Drive file's metadata if the hash matches a
 *      child of the target parent; null otherwise.
 *
 *   3. **Post-push folder dedupe** — group children by normalized name
 *      AND content hash, pick the survivor (oldest createdTime), move
 *      children of dupes into the survivor, then trash the empty dupes.
 *
 * Same credential-gating pattern as `drivePushWorker.ts`: when the
 * `getDriveCredentialStatus()` gate reports `not_configured`, the job
 * short-circuits with `skipped_no_credentials` and zero side effects.
 * Safe to register on a heartbeat schedule today.
 *
 * Implementation notes for the live path (preserved here so the future
 * implementer doesn't have to re-derive them):
 *
 *   - Pinned roots: never recurse INTO the 9 logical Hub folders (the
 *     parents themselves), only their CHILDREN. The constant
 *     `PINNED_HUB_ROOT_NAMES` below is the single source of truth.
 *
 *   - Folder tree walk: `drive.files.list({ q: "'${parent}' in parents
 *     and mimeType='application/vnd.google-apps.folder' and trashed=false",
 *     fields: 'files(id,name,createdTime,modifiedTime)' })`. Cap recursion
 *     at depth 6 — Mom's structure never exceeds 4 in practice.
 *
 *   - "Empty folder" definition: zero non-trashed children of any kind.
 *     The check is one `files.list` call per candidate folder; cheap.
 *
 *   - Trash, never delete: `drive.files.update({ fileId, requestBody:
 *     { trashed: true } })`. Mom can restore from Trash for 30 days if
 *     the heuristic mis-classified something.
 *
 *   - Hash dedupe: Drive populates `md5Checksum` on binary uploads
 *     automatically. For inline Markdown content the worker should
 *     compute SHA-256 over the bytes BEFORE upload and store it in our
 *     `drive_push_queue.contentHash` column (already present), then
 *     this job uses BOTH our column AND Drive's md5Checksum (when
 *     available) to identify duplicates.
 *
 *   - Survivor selection: oldest `createdTime` wins. If timestamps tie
 *     (rare), lowest ID wins for determinism.
 *
 *   - Move-then-trash: when a dupe folder has children, move them under
 *     the survivor with `drive.files.update({ fileId: childId, addParents:
 *     survivorId, removeParents: dupeId })` BEFORE trashing the dupe.
 *     This preserves any work the user may have done inside a dupe folder
 *     by accident.
 *
 *   - Outcome reporting: the summary includes per-job counts so the
 *     scheduled-task UI can render a useful "last run" line.
 */

import { getDriveCredentialStatus } from "./drivePushWorker";

/* =====================================================================
   Pinned Hub root names — single source of truth
   ===================================================================== */

/**
 * The 9 logical Hub folder names that must NEVER be trashed or moved.
 * Anything else under the Reagan Drive root is fair game for dedupe.
 *
 * (The matching folder IDs are resolved at runtime once credentials
 * arrive; right now we only need the names so the future implementer
 * has the allowlist.)
 */
export const PINNED_HUB_ROOT_NAMES = [
  "Daily Operations",
  "Curriculum and Resources",
  "Curriculum and Standards",
  "Reagan IHES",
  "Reagan Tutor",
  "Reagan Artwork",
  "Reagan Assignments",
  "Finished Work",
  "Adult Notes",
] as const;

export type PinnedHubRootName = (typeof PINNED_HUB_ROOT_NAMES)[number];

/**
 * True when the given folder name is a pinned Hub root and must be left
 * alone by every cleanup pass.
 */
export function isPinnedHubRoot(name: string): boolean {
  if (!name) return false;
  const normalized = name.trim();
  return (PINNED_HUB_ROOT_NAMES as readonly string[]).includes(normalized);
}

/* =====================================================================
   Outcome shapes
   ===================================================================== */

export type FolderDedupeSummary = {
  status: "skipped_no_credentials" | "ran" | "ran_with_errors";
  emptyFoldersTrashed: number;
  duplicateFoldersMerged: number;
  childFilesMoved: number;
  errorCount: number;
  reason?: string;
};

/* =====================================================================
   Public entry — schedule-safe nightly run
   ===================================================================== */

/**
 * Runs orphan-cleanup + post-push folder dedupe in one pass. Safe to
 * register as a nightly heartbeat task today; no-ops cleanly when
 * credentials are missing.
 */
export async function runDriveFolderDedupeJob(): Promise<FolderDedupeSummary> {
  const cred = getDriveCredentialStatus();
  if (cred.kind !== "ready") {
    return {
      status: "skipped_no_credentials",
      emptyFoldersTrashed: 0,
      duplicateFoldersMerged: 0,
      childFilesMoved: 0,
      errorCount: 0,
      reason: cred.reason,
    };
  }

  // Live path TBD — see module header for the wiring guide. We never
  // reach here today because the credential gate above short-circuits.
  return {
    status: "ran_with_errors",
    emptyFoldersTrashed: 0,
    duplicateFoldersMerged: 0,
    childFilesMoved: 0,
    errorCount: 1,
    reason:
      "driveFolderDedupeJob live path not yet implemented — credentials present but the job stub is still in place. See driveFolderDedupeJob.ts module header for the wiring guide.",
  };
}

/* =====================================================================
   Hash-based skip lookup (called from drivePushWorker before upload)
   ===================================================================== */

export type HashDuplicateMatch = {
  driveFileId: string;
  driveFileName: string;
  source: "our_hash" | "drive_md5";
};

/**
 * Returns the existing Drive file under `parentDriveFileId` whose content
 * hash matches `contentHash`, or null if no match. Today: returns null
 * (credentials missing) without making any network calls.
 *
 * `contentHash` should be the SHA-256 hex string the queue row carries
 * in `drive_push_queue.contentHash`. The live implementation will also
 * fall back to `md5Checksum` for legacy binary files that predate our
 * column.
 */
export async function findHashDuplicate(
  parentDriveFileId: string,
  contentHash: string,
): Promise<HashDuplicateMatch | null> {
  const cred = getDriveCredentialStatus();
  if (cred.kind !== "ready") return null;
  if (!parentDriveFileId || !contentHash) return null;
  if (!/^[0-9a-f]{64}$/i.test(contentHash)) {
    // Defensive: only honor canonical SHA-256 hex. Anything else is a
    // caller bug — better to fall through to upload than to false-skip.
    return null;
  }
  // Live path TBD — see module header.
  return null;
}
