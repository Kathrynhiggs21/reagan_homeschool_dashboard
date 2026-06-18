import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Bug fix 2026-05-30 — user reported that the "Download today's agenda PDF"
 * button in the nightly-agenda email was opening to an S3/CloudFront
 * "AccessDenied" XML page. Root cause: presigned URLs expire (~1h default)
 * and the email is opened hours / a day later, so by the time the recipient
 * clicks the link, the signature is dead.
 *
 * User direction was explicit: "fi not want url just auto on pdf" — drop
 * the URL entirely, deliver the PDF as a MIME attachment so it just opens
 * from the inbox.
 *
 * Earlier-2026 fix (cookie-gated link → absolute presigned URL) is now
 * obsolete; this contract test was rewritten to lock the new contract:
 *   1. The email HTML body MUST NOT contain a clickable PDF download link.
 *   2. The PDF MUST be in the attachments[] array passed to sendEmail.
 *   3. The HTML body MUST tell recipients the PDF is attached.
 */
describe("nightly-agenda-email — attachment-only contract (2026-05-30)", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "scheduledSync.ts"),
    "utf8",
  );

  it("does NOT render a 'Download today's agenda PDF' anchor in the email body", () => {
    // The old text was literally that string inside an <a>. Make sure it's
    // gone from the HTML body builder.
    expect(src).not.toContain("Download today's agenda PDF");
  });

  it("does NOT inject the absolutePdfUrl into the email HTML as a clickable link", () => {
    // The previous version had `${absolutePdfUrl ? `<a href="${absolutePdfUrl}"…` : ''}`
    // pattern. Search for the old pattern explicitly.
    expect(src).not.toMatch(/<a href=\\"\$\{absolutePdfUrl\}\\"/);
  });

  it("tells the recipient that the PDF is attached", () => {
    // Body should make the attachment obvious. 2026-06-18 slim body phrasing:
    // "Today's colored printable is attached as a PDF".
    expect(src).toContain("attached as a PDF");
  });

  it("still attaches the agenda PDF to the email's attachments[] array", () => {
    // Attachment build path must remain intact: agenda first, then worksheets.
    expect(src).toContain('kind: "agenda"');
    expect(src).toContain("contentBase64: pdfBuffer.toString(\"base64\")");
  });

  it("still passes attachments to the mailer's sendEmail call", () => {
    expect(src).toMatch(/sendEmail\(\s*\{[\s\S]+?attachments:\s*emailAttachments/);
  });
});
