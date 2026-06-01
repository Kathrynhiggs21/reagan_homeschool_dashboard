/**
 * Nightly-agenda-email cron contract lock (DONE 2026-05-17).
 *
 * The scheduled-task agent that emails the morning agenda PDF is OUTSIDE this
 * codebase. It calls `/api/scheduled/nightly-agenda-email`, gets back JSON,
 * and uses one of the URL-shaped fields to download the PDF for Gmail
 * attachment.
 *
 * On 2026-05-04 the agent reported it was getting 403/302 from `pdfUrl`
 * (`/manus-storage/...`) because that path is gated on the dashboard's user
 * OAuth cookie, not the cron cookie. The fix had ALREADY been shipped earlier
 * (Wave 8) — the response also returns `pdfDownloadUrl`, an absolute presigned
 * S3 URL that needs no cookie. But because no test locked the contract and
 * the field was undocumented in the response, the agent kept reaching for
 * `pdfUrl`.
 *
 * This test locks the contract surface so future refactors cannot drop the
 * field, and so anyone reading the response shape sees clearly that
 * `pdfDownloadUrl` is the cron-safe field.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "scheduledSync.ts"), "utf8");

describe("nightly-agenda-email cron contract", () => {
  it("the route is registered", () => {
    expect(src).toMatch(/app\.post\(["']\/api\/scheduled\/nightly-agenda-email["']/);
  });

  it("the response includes pdfDownloadUrl (the cron-safe absolute presigned URL)", () => {
    expect(src).toMatch(/pdfDownloadUrl:\s*absolutePdfUrl/);
  });

  it("absolutePdfUrl is built via storageGetSignedUrl with the actual storage key", () => {
    expect(src).toMatch(/absolutePdfUrl\s*=\s*await\s+storageGetSignedUrl\(\s*key\s*\)/);
  });

  it("the response keeps the legacy pdfUrl + pdfStorageKey fields too", () => {
    expect(src).toMatch(/pdfStorageKey:\s*key/);
    expect(src).toMatch(/pdfUrl:\s*url/);
  });

  it("the cron-agent contract is documented inline in the response builder", () => {
    // v3.28 (2026-06-01): the inline doc was tightened from a verbose
    //   /* CRON-AGENT CONTRACT ... */ block to terse end-of-line comments
    //   on each field (e.g. "DEPRECATED for cron; cookie-gated" and
    //   "CRON USES THIS — absolute presigned S3"). The contract this test
    //   enforces is unchanged: the response advertises pdfDownloadUrl as
    //   the cron-safe absolute presigned URL and explicitly deprecates
    //   pdfUrl as cookie-gated.
    expect(src).toMatch(/pdfDownloadUrl/);
    expect(src).toMatch(/absolute presigned S3/i);
    expect(src).toMatch(/cookie-gated|NOT cron-safe/i);
    expect(src).toMatch(/CRON USES THIS|CRON-AGENT CONTRACT/);
  });

  it("falls back gracefully when storageGetSignedUrl fails (does not throw)", () => {
    // The handler must wrap the presign call in try/catch so a transient S3
    // failure doesn't tank the whole response — pdfDownloadUrl can be null,
    // and the cron will see null and decide what to do (skip, retry, fall
    // back to pdfStorageKey + its own presigner). We assert the try/catch
    // structure is present.
    const presignBlock = src.match(
      /let\s+absolutePdfUrl[\s\S]*?absolutePdfUrl\s*=\s*await\s+storageGetSignedUrl\(\s*key\s*\)[\s\S]*?\}\s*catch/,
    );
    expect(presignBlock).not.toBeNull();
  });

  it("send_ready / resend_ready status values are stable", () => {
    expect(src).toMatch(/status:\s*isResend\s*\?\s*["']resend_ready["']\s*:\s*["']send_ready["']/);
  });
});
