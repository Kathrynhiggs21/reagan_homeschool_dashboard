/**
 * server/mailerResend.test.ts
 *
 * Locks in the contract of the new Resend-based mailer:
 *  - returns { ok: false, skipped: true } when RESEND_API_KEY is missing
 *  - returns { ok: true, messageId } when Resend accepts the send
 *  - MAIL_DEV_TO redirect actually rewrites the `to` and prefixes the subject
 *  - attachments are converted to base64 MIME parts
 *
 * We mock the `resend` SDK so the test is hermetic (no network, no quota burn).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

async function freshMailer() {
  // Re-import to pick up the latest env each test.
  vi.resetModules();
  return await import("./_core/mailer");
}

beforeEach(() => {
  sendMock.mockReset();
  delete process.env.MAIL_DEV_TO;
  delete process.env.MAIL_FROM;
  process.env.RESEND_API_KEY = "re_test_key";
});

describe("mailer (Resend)", () => {
  it("returns skipped when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await freshMailer();
    const res = await sendEmail({
      to: "x@example.com",
      subject: "hi",
      html: "<p>hi</p>",
    });
    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("delivers to all requested recipients when MAIL_DEV_TO is not set", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "msg_abc" }, error: null });
    const { sendEmail } = await freshMailer();
    const res = await sendEmail({
      to: ["a@example.com", "b@example.com"],
      subject: "hello",
      html: "<p>body</p>",
    });
    expect(res.ok).toBe(true);
    expect(res.messageId).toBe("msg_abc");
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toEqual(["a@example.com", "b@example.com"]);
    expect(call.subject).toBe("hello");
  });

  it("redirects to MAIL_DEV_TO and prefixes the subject with original recipients", async () => {
    process.env.MAIL_DEV_TO = "dev@inbox.test";
    sendMock.mockResolvedValueOnce({ data: { id: "msg_xyz" }, error: null });
    const { sendEmail } = await freshMailer();
    const res = await sendEmail({
      to: ["mom@gmail.com", "dad@gmail.com"],
      subject: "Reagan's school plan — Monday",
      html: "<p>hi</p>",
    });
    expect(res.ok).toBe(true);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toEqual(["dev@inbox.test"]);
    expect(call.subject).toBe(
      "[orig→mom@gmail.com,dad@gmail.com] Reagan's school plan — Monday",
    );
  });

  it("encodes attachment buffers as base64", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "msg_att" }, error: null });
    const { sendEmail } = await freshMailer();
    const pdfBytes = Buffer.from("%PDF-1.4 hello world");
    await sendEmail({
      to: "a@example.com",
      subject: "with attachment",
      html: "<p>see attached</p>",
      attachments: [
        { filename: "agenda.pdf", content: pdfBytes, contentType: "application/pdf" },
      ],
    });
    const call = sendMock.mock.calls[0][0];
    expect(call.attachments).toHaveLength(1);
    const att = call.attachments[0];
    expect(att.filename).toBe("agenda.pdf");
    expect(att.contentType).toBe("application/pdf");
    // base64 of "%PDF-1.4 hello world"
    expect(att.content).toBe(pdfBytes.toString("base64"));
  });

  it("surfaces Resend errors as { ok:false, error }", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "Bad recipient" },
    });
    const { sendEmail } = await freshMailer();
    const res = await sendEmail({
      to: "broken@example.com",
      subject: "hi",
      html: "<p>hi</p>",
    });
    expect(res.ok).toBe(false);
    expect(res.skipped).toBeFalsy();
    expect(res.error).toMatch(/validation_error/);
    expect(res.error).toMatch(/Bad recipient/);
  });

  it("derives a plain-text fallback from HTML when text is not provided", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "m" }, error: null });
    const { sendEmail } = await freshMailer();
    await sendEmail({
      to: "a@example.com",
      subject: "html only",
      html: "<style>p{color:red}</style><p>Hello <b>world</b></p>",
    });
    const call = sendMock.mock.calls[0][0];
    expect(call.text).toBe("Hello world");
  });
});
