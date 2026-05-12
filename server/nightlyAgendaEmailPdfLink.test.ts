import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Bug fix 2026-05-12 — shared task iPcHx9de76R5UjfLq8xZrH:
 * the nightly-agenda-email PDF link was previously embedded as the relative
 * `/manus-storage/{key}` path, which requires a dashboard cookie to follow
 * the 307 redirect. Mom and Grandma clicking from Gmail had no cookie and
 * landed on a login redirect.
 *
 * Fix: call `storageGetSignedUrl(key)` to get an absolute presigned S3 GET
 * URL, embed THAT in the email body, and return it from the endpoint as
 * `pdfDownloadUrl` so the gmail MCP uses it.
 *
 * This is a source-level contract test (no live HTTP) so it is hermetic.
 */
describe("nightly-agenda-email — PDF link cookie fix", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "scheduledSync.ts"),
    "utf8",
  );

  it("imports storageGetSignedUrl alongside storagePut", () => {
    expect(src).toContain('const { storagePut, storageGetSignedUrl }');
  });

  it("calls storageGetSignedUrl(key) on the just-uploaded PDF", () => {
    expect(src).toContain("storageGetSignedUrl(key)");
  });

  it("renders an absolute download link inside the HTML email body", () => {
    expect(src).toContain("absolutePdfUrl");
    expect(src).toContain("Download today's agenda PDF");
  });

  it("returns pdfDownloadUrl (absolute) alongside pdfUrl (relative) so gmail MCP can pick the right one", () => {
    expect(src).toContain("pdfDownloadUrl: absolutePdfUrl");
  });

  it("falls back gracefully when presign fails (still sends email with attachment)", () => {
    expect(src).toContain("absolutePdfUrl = null");
    expect(src).toContain("attachment-only delivery");
  });

  it("explicitly notes WHY the fix exists (cookie not available to email recipients)", () => {
    expect(src).toContain("dashboard cookie to follow");
    expect(src).toContain("Mom and Grandma do");
  });
});
