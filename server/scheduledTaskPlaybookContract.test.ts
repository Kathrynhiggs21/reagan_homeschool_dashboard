import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * v2.29 (2026-05-18) — Lock the scheduled-task playbook contract.
 *
 * The playbook at references/scheduled-task-playbook.md is the source-of-truth
 * prompt for the Manus AGENT cron that sends Reagan's nightly agenda email and
 * mirrors files into the Google Drive Hub. It MUST stay in sync with the
 * /api/scheduled/* endpoints in server/scheduledSync.ts. If the response shape
 * of /api/scheduled/nightly-agenda-email changes (e.g. pdfDownloadUrl is
 * removed, attachments[] field gets renamed) the playbook needs to change in
 * the same push.
 *
 * This file reads the playbook + scheduledSync.ts as plain text and asserts
 * that the load-bearing contract claims still match. It does NOT spin up the
 * server.
 */

const ROOT = "/home/ubuntu/reagan_homeschool_dashboard";
const PLAYBOOK = join(ROOT, "references", "scheduled-task-playbook.md");
const SYNC = join(ROOT, "server", "scheduledSync.ts");

function readPlaybook(): string {
  expect(existsSync(PLAYBOOK)).toBe(true);
  return readFileSync(PLAYBOOK, "utf8");
}

function readSync(): string {
  expect(existsSync(SYNC)).toBe(true);
  return readFileSync(SYNC, "utf8");
}

describe("scheduled-task playbook contract", () => {
  it("playbook file exists at the expected path", () => {
    expect(existsSync(PLAYBOOK)).toBe(true);
  });

  it("references both Job A and Job B by name", () => {
    const t = readPlaybook();
    expect(t).toMatch(/Job A — Nightly agenda email/);
    expect(t).toMatch(/Job B — (Continuous )?Drive Hub mirror/);
  });

  it("Job A targets the nightly-agenda-email endpoint", () => {
    const t = readPlaybook();
    expect(t).toContain("/api/scheduled/nightly-agenda-email");
    expect(t).toContain("/api/scheduled/nightly-agenda-email/result");
  });

  it("Job B targets the four drive endpoints", () => {
    const t = readPlaybook();
    expect(t).toContain("/api/scheduled/drive-folder-map");
    expect(t).toContain("/api/scheduled/drive-folder-map/result");
    expect(t).toContain("/api/scheduled/drive-push/pending");
    expect(t).toContain("/api/scheduled/drive-push/result");
    expect(t).toContain("/api/scheduled/drive-snapshot");
  });

  it("instructs the agent to use pdfDownloadUrl (not pdfUrl) for the email body", () => {
    const t = readPlaybook();
    // Must explicitly tell the agent to use pdfDownloadUrl
    expect(t).toMatch(/pdfDownloadUrl/);
    // And explicitly warn against pdfUrl in the email body
    expect(t).toMatch(/pdfDownloadUrl[^\n]*not[^\n]*pdfUrl|never[^\n]*pdfUrl/i);
  });

  it("instructs the agent to decode contentBase64 to /tmp file paths for Gmail MCP", () => {
    const t = readPlaybook();
    expect(t).toContain("contentBase64");
    expect(t).toContain("/tmp/agenda-");
    // Gmail MCP attachments are file paths, not base64
    expect(t).toMatch(/file path|absolute file path/);
  });

  it("explains Gmail MCP accepts plain content (not htmlBody)", () => {
    const t = readPlaybook();
    expect(t).toMatch(/gmail_send_messages/);
    expect(t).toMatch(/plain[- ]?text|content/);
    // Calls out that htmlBody is not a separate field
    expect(t).toMatch(/does not accept .*htmlBody|not[^\n]*htmlBody/i);
  });

  it("acks the agenda email by recordId + status", () => {
    const t = readPlaybook();
    expect(t).toContain("recordId");
    expect(t).toMatch(/"status":\s*"sent"/);
  });

  it("warns NEVER to recreate the 9 canonical top-level Drive folders", () => {
    const t = readPlaybook();
    expect(t).toMatch(/never recreate the 9 (canonical )?top-level folders|Never recreate the 9/i);
  });

  it("documents at least 7 of the 9 canonical top-level Drive parent names", () => {
    const t = readPlaybook();
    const expected = [
      "Admin and Homeschool Records",
      "Adventures and Enrichment",
      "Assignments and Work",
      "Curriculum and Standards",
      "Daily Operations",
      "Inbox (Unsorted)",
      "Printables and Resources",
      "Progress and Reports",
      "Todo",
    ];
    const hit = expected.filter((p) => t.includes(p));
    expect(hit.length).toBeGreaterThanOrEqual(7);
  });

  it("documents the drive-push/pending enrichment fields the agent uses", () => {
    const t = readPlaybook();
    expect(t).toContain("canonicalParentFolderId");
    expect(t).toContain("subfolderName");
    expect(t).toContain("targetSubpath");
  });

  it("documents the drive-push/result status enum", () => {
    const t = readPlaybook();
    expect(t).toContain('"pushed"');
    expect(t).toContain('"failed"');
    // skipped is the third valid status
    expect(t).toMatch(/skipped/);
  });

  it("explicitly says cron auth is automatic (no bearer token)", () => {
    const t = readPlaybook();
    expect(t).toMatch(/sdk\.authenticateRequest|cron caller/i);
    expect(t).toMatch(/no bearer token|automatic|never[^\n]*Bearer/i);
  });

  it("uses $SCHEDULED_TASK_ENDPOINT_BASE and $SCHEDULED_TASK_COOKIE env vars", () => {
    const t = readPlaybook();
    expect(t).toContain("$SCHEDULED_TASK_ENDPOINT_BASE");
    expect(t).toContain("$SCHEDULED_TASK_COOKIE");
    expect(t).toContain("Cookie: app_session_id=$SCHEDULED_TASK_COOKIE");
  });

  it("references both connector UIDs (Gmail + Google Drive)", () => {
    const t = readPlaybook();
    expect(t).toContain("9444d960-ab7e-450f-9cb9-b9467fb0adda"); // Gmail
    expect(t).toContain("f8900a57-4bd7-46cc-83a3-5ebd2420a817"); // Google Drive
  });

  it("defers schedule registration until the dashboard is published", () => {
    const t = readPlaybook();
    expect(t).toMatch(/manus\.space/);
    expect(t).toMatch(/deferred|do not register|until[^\n]*publish/i);
  });

  it("includes a paste-ready cron prompt section", () => {
    const t = readPlaybook();
    expect(t).toMatch(/Cron prompt|paste-ready/i);
  });

  // ---------- cross-checks against scheduledSync.ts ----------
  it("scheduledSync.ts still emits pdfDownloadUrl in the nightly-agenda-email response", () => {
    const t = readSync();
    expect(t).toContain("pdfDownloadUrl");
    // Ensure it's the absolute presigned S3 URL contract (cron-agent contract block)
    expect(t).toMatch(/CRON USES THIS|absolute presigned S3/);
  });

  it("scheduledSync.ts still emits attachments[] with contentBase64 + kind", () => {
    const t = readSync();
    expect(t).toContain("contentBase64");
    expect(t).toMatch(/kind:\s*"agenda"/);
    expect(t).toMatch(/kind:\s*"worksheet"/);
  });

  it("scheduledSync.ts still emits recordId on the agenda email response", () => {
    const t = readSync();
    expect(t).toContain("recordId");
  });

  it("scheduledSync.ts still emits the unchanged short-circuit status", () => {
    const t = readSync();
    expect(t).toMatch(/status:\s*"unchanged"/);
  });

  it("scheduledSync.ts still emits send_ready / resend_ready on the email response", () => {
    const t = readSync();
    expect(t).toMatch(/send_ready/);
    expect(t).toMatch(/resend_ready/);
  });

  it("scheduledSync.ts still enriches drive-push/pending with canonicalParentFolderId + subfolderName", () => {
    const t = readSync();
    expect(t).toContain("canonicalParentFolderId");
    expect(t).toContain("subfolderName");
  });

  it("scheduledSync.ts still validates drive-push/result status as pushed|skipped|failed", () => {
    const t = readSync();
    expect(t).toMatch(/"pushed",\s*"skipped",\s*"failed"/);
  });

  it("scheduledSync.ts still mounts all 7 endpoints the playbook references", () => {
    const t = readSync();
    expect(t).toMatch(/app\.post\(\s*"\/api\/scheduled\/nightly-agenda-email"/);
    expect(t).toMatch(/app\.post\(\s*"\/api\/scheduled\/nightly-agenda-email\/result"/);
    expect(t).toMatch(/app\.get\(\s*"\/api\/scheduled\/drive-folder-map"/);
    expect(t).toMatch(/app\.post\(\s*"\/api\/scheduled\/drive-folder-map\/result"/);
    expect(t).toMatch(/app\.get\(\s*"\/api\/scheduled\/drive-push\/pending"/);
    expect(t).toMatch(/app\.post\(\s*"\/api\/scheduled\/drive-push\/result"/);
    expect(t).toMatch(/app\.get\(\s*"\/api\/scheduled\/drive-snapshot"/);
  });
});
