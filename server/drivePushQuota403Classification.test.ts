/**
 * server/drivePushQuota403Classification.test.ts
 *
 * v3.31 (2026-06-18) — Service-account quota-403 classification.
 *
 * Root cause of the "stale Drive hub" report: the recurring drive-push-drain
 * job authenticates as the Google Calendar SERVICE ACCOUNT (reused for Drive).
 * A bare service account has NO Drive storage quota of its own, so every
 * upload into Katy's personal "My Drive" hub fails with HTTP 403
 * "Service Accounts do not have storage quota."
 *
 * That is NOT a transient failure — retrying forever can never succeed. The
 * worker now rewrites this error to a clear, actionable `NEEDS_USER_OAUTH:`
 * message so the Drive Hub card surfaces the real remedy (provide a user-OAuth
 * token for the Drive owner, or use a Shared Drive) instead of a flaky-looking
 * 403. This test pins that classification.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runDrivePushWorker, type WorkerDeps } from "./_lib/drivePushWorker";
import type { DriveClient } from "./_lib/driveClient";

const QUOTA_403 =
  'Drive upload 403: {"error":{"code":403,"message":"Service Accounts do not have storage quota. Leverage shared drives, or use OAuth delegation instead.","errors":[{"reason":"storageQuotaExceeded"}]}}';

function makeQuotaFailingDrive(): DriveClient {
  return {
    async listChildren() {
      return [];
    },
    async createFolder() {
      return "folder-1";
    },
    async uploadFile() {
      throw new Error(QUOTA_403);
    },
  };
}

function makeDeps(rows: any[]) {
  const results: Array<{ id: number; status: string; errorMessage?: string | null }> = [];
  const deps: WorkerDeps = {
    listPendingDrivePushes: async (limit) => rows.slice(0, limit) as any,
    markDrivePushResult: async (args) => {
      results.push(args);
      return undefined;
    },
    getCanonicalParentForRoutable: async () => ({ slug: "dailyOperations", folderId: "PARENT_DAILY" }) as any,
    getCanonicalSubfolderId: async () => "SUB_DAYLOGS",
    setAppSetting: async () => undefined,
    CANONICAL_PARENT_NAMES: { dailyOperations: "Daily Operations" } as any,
    DRIVE_FOLDER_NAMES: { day_log: "Day Logs" } as any,
  };
  return { deps, results };
}

const savedToken = process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
const savedSa = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
beforeEach(() => {
  process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.test-token";
  delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
});
afterEach(() => {
  if (savedToken !== undefined) process.env.GOOGLE_DRIVE_OAUTH_TOKEN = savedToken;
  else delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  if (savedSa !== undefined) process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = savedSa;
  else delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  vi.restoreAllMocks();
});

describe("worker — service-account quota 403 classification", () => {
  it("rewrites the quota 403 to a NEEDS_USER_OAUTH actionable error", async () => {
    const row = {
      id: 1,
      fileName: "2026-06-18 - Day Log.md",
      targetFolder: "day_log",
      targetSubpath: "",
      contentText: "# Day Log",
    };
    const { deps, results } = makeDeps([row]);
    const summary = await runDrivePushWorker({ driveClient: makeQuotaFailingDrive(), deps });

    expect(summary.failed).toBe(1);
    expect(summary.pushed).toBe(0);
    const failed = results.find((r) => r.status === "failed")!;
    expect(failed.id).toBe(1);
    expect(failed.errorMessage).toMatch(/^NEEDS_USER_OAUTH:/);
    // The original message is preserved for debugging.
    expect(failed.errorMessage).toMatch(/Service Accounts do not have storage quota/);
  });

  it("does NOT rewrite an unrelated error", async () => {
    const row = {
      id: 2,
      fileName: "x.md",
      targetFolder: "day_log",
      targetSubpath: "",
      contentText: "x",
    };
    const drive: DriveClient = {
      async listChildren() { return []; },
      async createFolder() { return "f"; },
      async uploadFile() { throw new Error("Drive upload 500: transient backend error"); },
    };
    const { deps, results } = makeDeps([row]);
    const summary = await runDrivePushWorker({ driveClient: drive, deps });

    expect(summary.failed).toBe(1);
    const failed = results.find((r) => r.status === "failed")!;
    expect(failed.errorMessage).not.toMatch(/NEEDS_USER_OAUTH/);
    expect(failed.errorMessage).toMatch(/transient backend error/);
  });
});
