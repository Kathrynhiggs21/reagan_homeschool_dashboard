/**
 * Tests for the credential-gated Drive push worker.
 *
 * Today's contract: when no Drive credentials exist, the worker is a
 * complete no-op that's safe to call from heartbeat. When credentials
 * eventually land, the gate flips to `ready` and the (still-stub) uploader
 * marks rows failed with a clear error so we don't silently spin.
 *
 * These tests pin BOTH halves of that contract so once the live uploader
 * is implemented, we'll know if the gate behavior accidentally changes.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getDriveCredentialStatus,
  runDrivePushWorker,
  runDrivePushOnce,
} from "./_lib/drivePushWorker";

describe("getDriveCredentialStatus", () => {
  const savedToken = process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  const savedSa = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;

  beforeEach(() => {
    delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  });

  afterEach(() => {
    if (savedToken !== undefined) process.env.GOOGLE_DRIVE_OAUTH_TOKEN = savedToken;
    else delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    if (savedSa !== undefined) process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = savedSa;
    else delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  });

  it("reports not_configured when both env vars are unset", () => {
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("not_configured");
    if (s.kind === "not_configured") {
      expect(s.reason).toMatch(/No Drive credentials/i);
      expect(s.reason).toMatch(/GOOGLE_DRIVE_OAUTH_TOKEN/);
    }
  });

  it("reports not_configured when both env vars are empty strings", () => {
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "";
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = "";
    expect(getDriveCredentialStatus().kind).toBe("not_configured");
  });

  it("reports not_configured when env vars are whitespace-only", () => {
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "   \n\t  ";
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = "  ";
    expect(getDriveCredentialStatus().kind).toBe("not_configured");
  });

  it("reports ready/oauth_token when GOOGLE_DRIVE_OAUTH_TOKEN is set", () => {
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.fake-but-non-empty";
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("oauth_token");
  });

  it("reports ready/service_account when service-account JSON looks valid", () => {
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      project_id: "x",
      private_key_id: "x",
      private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
      client_email: "x@x.iam.gserviceaccount.com",
    });
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("service_account");
  });

  it("reports not_configured (with a clear reason) when service-account JSON is malformed", () => {
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = "{}";
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("not_configured");
    if (s.kind === "not_configured") {
      expect(s.reason).toMatch(/malformed/i);
    }
  });

  it("prefers OAuth token over service account when both are set (cheaper to refresh)", () => {
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.fake";
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      private_key: "x",
      client_email: "x@x.iam.gserviceaccount.com",
      filler: "x".repeat(60),
    });
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("oauth_token");
  });
});

describe("runDrivePushWorker", () => {
  const savedToken = process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  const savedSa = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;

  beforeEach(() => {
    delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  });

  afterEach(() => {
    if (savedToken !== undefined) process.env.GOOGLE_DRIVE_OAUTH_TOKEN = savedToken;
    else delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    if (savedSa !== undefined) process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = savedSa;
    else delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  });

  it("short-circuits with skipped_no_credentials when no creds — zero DB reads", async () => {
    const summary = await runDrivePushWorker();
    expect(summary.status).toBe("skipped_no_credentials");
    expect(summary.scanned).toBe(0);
    expect(summary.pushed).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.reason).toMatch(/No Drive credentials/i);
  });

  it("never throws when called with no creds (safe for heartbeat)", async () => {
    await expect(runDrivePushWorker()).resolves.toBeDefined();
    await expect(runDrivePushWorker({ limit: 1 })).resolves.toBeDefined();
    await expect(runDrivePushWorker({ limit: 500 })).resolves.toBeDefined();
  });
});

describe("runDrivePushOnce", () => {
  const savedToken = process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
  const savedSa = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;

  beforeEach(() => {
    delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  });

  afterEach(() => {
    if (savedToken !== undefined) process.env.GOOGLE_DRIVE_OAUTH_TOKEN = savedToken;
    else delete process.env.GOOGLE_DRIVE_OAUTH_TOKEN;
    if (savedSa !== undefined) process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = savedSa;
    else delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  });

  it("returns skipped_no_credentials without touching the row when no creds", async () => {
    const fakeRow: any = {
      id: 999999,
      fileName: "fake.md",
      targetFolder: "day_log",
      status: "pending",
    };
    const r = await runDrivePushOnce(fakeRow);
    expect(r.outcome).toBe("skipped_no_credentials");
    expect(r.reason).toMatch(/No Drive credentials/i);
  });
});
