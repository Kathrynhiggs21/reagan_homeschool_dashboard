/**
 * server/nightlyAgendaFreshContent.test.ts — v3.24 (2026-05-31)
 *
 * Locks the "fresh content per run" guarantees that prevent the
 * dead-PDF-link regression Mom hit in v3.23.
 *
 * History: the weekday 6:30 AM ET scheduler was paused on 2026-05-31
 * because the agent-cron task was emitting emails whose only PDF link
 * was a stale signed CloudFront URL embedded into the email body. Once
 * the URL expired, recipients saw an "AccessDenied" XML page when they
 * clicked.
 *
 * Two-part fix verified by this spec:
 *
 * 1. The `nightlyAgenda.sendNow` mutation re-assembles the agenda and
 *    rebuilds the PDF on EVERY call. There is no caching keyed on date
 *    that would cause two consecutive calls to share a stale buffer.
 *
 * 2. The Resend email body NEVER contains a signed S3 URL. The PDF
 *    rides as an attachment file (`pdfBuffer`), so it cannot rot.
 *
 * The test is source-level (string assertions over `routers.ts`) — same
 * pattern as `nightlyAgendaSendNow.test.ts`. The runtime path already
 * has integration coverage in `nightlyAgendaEmailDispatch.test.ts` and
 * `agendaPdfBuilder.test.ts`, so we don't duplicate that work here.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const routersPath = path.join(ROOT, "server", "routers.ts");
const src = fs.readFileSync(routersPath, "utf8");

function getSendNowBody(): string {
  const idx = src.indexOf("sendNow:");
  expect(idx).toBeGreaterThan(0);
  // Take a generous slice; the mutation body is ~250 lines.
  return src.slice(idx, idx + 16000);
}

describe("nightlyAgenda.sendNow — fresh-content-per-run (v3.24)", () => {
  it("re-assembles the agenda inside the mutation body (no module-level cache)", () => {
    const body = getSendNowBody();
    // The call must live inside the mutation body, not pulled from a closure.
    expect(body).toMatch(/const payload = await assembleAgendaForDate\(forDate\);/);
  });

  it("re-runs auto-attach inside the mutation body BEFORE assembling", () => {
    const body = getSendNowBody();
    const autoAt = body.indexOf("runAutoAttachForDate(forDate");
    const assembleAt = body.indexOf("assembleAgendaForDate(forDate");
    expect(autoAt).toBeGreaterThan(0);
    expect(assembleAt).toBeGreaterThan(autoAt);
  });

  it("rebuilds the PDF in-band on every call (no shared buffer between dates)", () => {
    const body = getSendNowBody();
    expect(body).toMatch(
      /const \{ pdfBuffer, agendaHash \} = await buildAgendaPdf\(payload as any\);/,
    );
  });

  it("uses a content-hashed S3 key so a re-run with identical content is idempotent", () => {
    const body = getSendNowBody();
    expect(body).toMatch(
      /const fileKey = `nightly-agendas\/\$\{forDate\}\/agenda_\$\{agendaHash\.slice\(0, 8\)\}\.pdf`/,
    );
  });

  it("PDF rides as an attachment file (Buffer), not as a URL in the email body", () => {
    const body = getSendNowBody();
    // The Resend send must include the PDF buffer as an attachment.
    expect(body).toMatch(
      /content:\s*pdfBuffer,\s*contentType:\s*"application\/pdf"/,
    );
    // And the filename must come from forDate + studentName.
    expect(body).toMatch(
      /filename:\s*`\$\{forDate\} - \$\{payload\.studentName\} - Agenda\.pdf`/,
    );
  });

  it("email body does NOT inject a signed S3 / CloudFront URL", () => {
    const body = getSendNowBody();
    // The HTML body string must not interpolate `signedUrl` or any
    // raw S3 URL pattern.
    const htmlIdx = body.indexOf("const html = `");
    expect(htmlIdx).toBeGreaterThan(0);
    const htmlSlice = body.slice(htmlIdx, htmlIdx + 4000);
    expect(htmlSlice).not.toContain("${signedUrl}");
    expect(htmlSlice).not.toMatch(/cloudfront\.net/);
    expect(htmlSlice).not.toMatch(/\.s3[.-][a-z0-9-]+\.amazonaws\.com/);
    expect(htmlSlice).not.toMatch(/X-Amz-Signature/);
  });

  it("notifyOwner content explicitly states 'PDF attached' (no link replay)", () => {
    const body = getSendNowBody();
    // The owner-notification body must reference the attachment, not a URL.
    expect(body).toMatch(/PDF attached\./);
    // And the linkLine variable must still be the no-URL string introduced
    // 2026-05-30. v3.32 appends the readiness legend via readinessLegendText(),
    // so the assignment now starts the same way but is concatenated.
    expect(body).toMatch(/const linkLine =\s*`\\n\\nPDF attached\./);
    // v3.32: the readiness legend is appended (single source of truth helper).
    expect(body).toContain("readinessLegendText()");
  });

  it("Resend send list targets BOTH Marcy and Mom (no fallback to old single-recipient path)", () => {
    const body = getSendNowBody();
    expect(body).toMatch(
      /to:\s*\["marcy\.spear@gmail\.com",\s*"spear\.cpt@gmail\.com"\]/,
    );
  });

  it("per-block worksheet attachments are also computed in-band, not cached", () => {
    const body = getSendNowBody();
    expect(body).toMatch(
      /const wsAtts = await buildPerBlockWorksheetAttachments\(payload as any\);/,
    );
  });

  it("status is computed AFTER the email send, never speculatively", () => {
    // 2026-06-18 — the notifyOwner "school plan" summary push was removed so
    // adults get ONLY the printables-PDF email. The remaining ordering
    // contract: build email -> sendEmail -> mark status.
    const body = getSendNowBody();
    const emailAt = body.indexOf("emailResult = await sendEmail");
    const markAt = body.indexOf("markNightlyAgendaEmailStatus");
    expect(emailAt).toBeGreaterThan(0);
    expect(markAt).toBeGreaterThan(emailAt);
    // The summary notifyOwner push must be gone (notified hard-set to false).
    expect(body).not.toContain("notified = await notifyOwner");
    expect(body).toContain("const notified = false;");
  });
});

describe("nightlyAgenda.sendNow — no stale-URL replay (v3.24)", () => {
  it("the explicit `void signedUrl;` comment justifies why signedUrl exists at all", () => {
    // We keep the storageGetSignedUrl call so a presign failure still
    // shows up in logs, but the URL itself is intentionally unused.
    const body = getSendNowBody();
    expect(body).toMatch(/void signedUrl;/);
  });

  it("the comment block above linkLine documents the 2026-05-30 fix", () => {
    const body = getSendNowBody();
    // Anchor a fragment of the explanatory comment so accidental rewrites
    // surface a test failure that points the maintainer at the history.
    expect(body).toContain("dropped the signed-URL line from the owner notification");
  });

  it("the historical bug shape (raw URL inside email body string) is not re-introduced", () => {
    // Defensive: scan the entire mutation body for any `+ signedUrl +`
    // or `${signedUrl}` interpolation inside an email/html context.
    const body = getSendNowBody();
    // Allow signedUrl to appear once in the response object (returned
    // for debug only) but never inside the html/body composition.
    const composition = body.slice(body.indexOf("const html = `"), body.indexOf("emailResult = await sendEmail"));
    expect(composition).not.toContain("signedUrl");
  });
});
