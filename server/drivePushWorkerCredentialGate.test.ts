/**
 * Tests for the credential-gated Drive push worker.
 *
 * Contract:
 *  - When NO Drive credential exists (neither dedicated GOOGLE_DRIVE_* nor a
 *    reusable GOOGLE_CALENDAR_* credential), the worker is a complete no-op
 *    that's safe to call from heartbeat.
 *  - A dedicated GOOGLE_DRIVE_OAUTH_TOKEN or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
 *    flips the gate to `ready`.
 *  - (2026-06-18, approved by Katy) When no dedicated Drive credential is set,
 *    the gate reuses the Google CALENDAR credential
 *    (GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON / GOOGLE_CALENDAR_OAUTH_TOKEN), so
 *    one Google credential powers both Calendar and Drive.
 *
 * NOTE: the live environment may carry a real GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON,
 * so every block clears the Calendar vars too in beforeEach to isolate the
 * specific contract under test.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getDriveCredentialStatus,
  runDrivePushWorker,
  runDrivePushOnce,
} from "./_lib/drivePushWorker";

const CRED_KEYS = [
  "GOOGLE_DRIVE_OAUTH_TOKEN",
  "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_CALENDAR_OAUTH_TOKEN",
  "GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON",
] as const;

function snapshotCreds(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const k of CRED_KEYS) snap[k] = process.env[k];
  return snap;
}
function clearCreds() {
  for (const k of CRED_KEYS) delete process.env[k];
}
function restoreCreds(snap: Record<string, string | undefined>) {
  for (const k of CRED_KEYS) {
    if (snap[k] !== undefined) process.env[k] = snap[k];
    else delete process.env[k];
  }
}

const FAKE_SA = JSON.stringify({
  type: "service_account",
  project_id: "x",
  private_key_id: "x",
  private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
  client_email: "x@x.iam.gserviceaccount.com",
});

describe("getDriveCredentialStatus", () => {
  const saved = snapshotCreds();
  beforeEach(() => clearCreds());
  afterEach(() => restoreCreds(saved));

  it("reports not_configured when all credential env vars are unset", () => {
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("not_configured");
    if (s.kind === "not_configured") {
      expect(s.reason).toMatch(/No Drive credentials/i);
      expect(s.reason).toMatch(/GOOGLE_DRIVE_OAUTH_TOKEN/);
    }
  });

  it("reports not_configured when all credential env vars are empty strings", () => {
    for (const k of CRED_KEYS) process.env[k] = "";
    expect(getDriveCredentialStatus().kind).toBe("not_configured");
  });

  it("reports not_configured when credential env vars are whitespace-only", () => {
    for (const k of CRED_KEYS) process.env[k] = "   \n\t  ";
    expect(getDriveCredentialStatus().kind).toBe("not_configured");
  });

  it("reports ready/oauth_token when GOOGLE_DRIVE_OAUTH_TOKEN is set", () => {
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.fake-but-non-empty";
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("oauth_token");
  });

  it("reports ready/service_account when service-account JSON looks valid", () => {
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = FAKE_SA;
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
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = FAKE_SA;
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("oauth_token");
  });

  // --- Calendar-credential reuse (2026-06-18) ---

  it("falls back to the Calendar service account when no dedicated Drive cred is set", () => {
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = FAKE_SA;
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("calendar_service_account");
  });

  it("falls back to the Calendar OAuth token when no dedicated Drive cred or Calendar SA is set", () => {
    process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = "ya29.calendar-token";
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("calendar_oauth_token");
  });

  it("prefers a dedicated Drive credential over the Calendar fallback", () => {
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON = FAKE_SA;
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = FAKE_SA;
    const s = getDriveCredentialStatus();
    expect(s.kind).toBe("ready");
    if (s.kind === "ready") expect(s.source).toBe("service_account");
  });

  it("does NOT fall back to a malformed Calendar service account", () => {
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = "{}";
    expect(getDriveCredentialStatus().kind).toBe("not_configured");
  });
});

describe("runDrivePushWorker", () => {
  const saved = snapshotCreds();
  beforeEach(() => clearCreds());
  afterEach(() => restoreCreds(saved));

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
  const saved = snapshotCreds();
  beforeEach(() => clearCreds());
  afterEach(() => restoreCreds(saved));

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
