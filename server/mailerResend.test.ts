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
const smtpSendMailMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockImplementation(() => ({
      sendMail: smtpSendMailMock,
    })),
  },
}));

async function freshMailer() {
  // Re-import to pick up the latest env each test.
  vi.resetModules();
  return await import("./_core/mailer");
}

beforeEach(() => {
  sendMock.mockReset();
  smtpSendMailMock.mockReset();
  delete process.env.MAIL_DEV_TO;
  delete process.env.MAIL_FROM;
  delete process.env.MAIL_ALLOWED_RECIPIENTS;
  delete process.env.GMAIL_SMTP_USER;
  delete process.env.GMAIL_APP_PASSWORD;
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

  it("falls back to per-recipient send when Resend free-tier rejects multi-recipient", async () => {
    // First call: multi-recipient send rejected with the free-tier error.
    sendMock.mockResolvedValueOnce({
      data: null,
      error: {
        name: "validation_error",
        message:
          "You can only send testing emails to your own email address (spear.cpt@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain.",
      },
    });
    // Per-recipient retry: marcy rejected, spear accepted.
    sendMock.mockResolvedValueOnce({
      data: null,
      error: {
        name: "validation_error",
        message: "You can only send testing emails to your own email address",
      },
    });
    sendMock.mockResolvedValueOnce({ data: { id: "msg_partial" }, error: null });

    const { sendEmail } = await freshMailer();
    const res = await sendEmail({
      to: ["marcy.spear@gmail.com", "spear.cpt@gmail.com"],
      subject: "Plan",
      html: "<p>hi</p>",
    });
    expect(res.ok).toBe(true);
    expect(res.messageId).toBe("msg_partial");
    expect(res.acceptedRecipients).toEqual(["spear.cpt@gmail.com"]);
    expect(res.droppedRecipients).toEqual(["marcy.spear@gmail.com"]);
    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  it("drops recipients not in MAIL_ALLOWED_RECIPIENTS before sending", async () => {
    process.env.MAIL_ALLOWED_RECIPIENTS = "spear.cpt@gmail.com";
    sendMock.mockResolvedValueOnce({ data: { id: "msg_allow" }, error: null });
    const { sendEmail } = await freshMailer();
    const res = await sendEmail({
      to: ["marcy.spear@gmail.com", "spear.cpt@gmail.com"],
      subject: "Filtered",
      html: "<p>hi</p>",
    });
    expect(res.ok).toBe(true);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toEqual(["spear.cpt@gmail.com"]);
    expect(res.droppedRecipients).toEqual(["marcy.spear@gmail.com"]);
  });

  it("returns skipped when MAIL_ALLOWED_RECIPIENTS strips every requested address AND no SMTP fallback configured", async () => {
    process.env.MAIL_ALLOWED_RECIPIENTS = "someone-else@gmail.com";
    // No GMAIL_SMTP_USER/PASSWORD set — SMTP fallback disabled.
    const { sendEmail } = await freshMailer();
    const res = await sendEmail({
      to: ["marcy.spear@gmail.com", "spear.cpt@gmail.com"],
      subject: "None allowed",
      html: "<p>hi</p>",
    });
    expect(res.ok).toBe(false);
    expect(res.acceptedRecipients).toEqual([]);
    // The fallback was attempted (and rejected for both addresses since SMTP
    // creds are absent); Resend was never called.
    expect(sendMock).not.toHaveBeenCalled();
    expect(res.droppedRecipients).toEqual(
      expect.arrayContaining([
        "marcy.spear@gmail.com",
        "spear.cpt@gmail.com",
      ]),
    );
  });

  it("falls back to Gmail SMTP for recipients dropped by MAIL_ALLOWED_RECIPIENTS", async () => {
    process.env.MAIL_ALLOWED_RECIPIENTS = "spear.cpt@gmail.com";
    process.env.GMAIL_SMTP_USER = "sender@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "app-password";
    sendMock.mockResolvedValueOnce({ data: { id: "resend_msg_1" }, error: null });
    smtpSendMailMock.mockResolvedValueOnce({ messageId: "smtp_msg_1" });
    const { sendEmail } = await freshMailer();
    const res = await sendEmail({
      to: ["marcy.spear@gmail.com", "spear.cpt@gmail.com"],
      subject: "Both should land",
      html: "<p>body</p>",
    });
    expect(res.ok).toBe(true);
    // Resend got the verified address only.
    expect(sendMock.mock.calls[0][0].to).toEqual(["spear.cpt@gmail.com"]);
    // SMTP fallback got the dropped address.
    expect(smtpSendMailMock).toHaveBeenCalledTimes(1);
    expect(smtpSendMailMock.mock.calls[0][0].to).toBe("marcy.spear@gmail.com");
    expect(res.acceptedRecipients).toEqual(
      expect.arrayContaining(["spear.cpt@gmail.com", "marcy.spear@gmail.com"]),
    );
  });

  it("goes straight to SMTP fallback when ALL recipients are dropped by allow-list", async () => {
    process.env.MAIL_ALLOWED_RECIPIENTS = "someone-else@gmail.com";
    process.env.GMAIL_SMTP_USER = "sender@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "app-password";
    smtpSendMailMock.mockResolvedValue({ messageId: "smtp_msg_only" });
    const { sendEmail } = await freshMailer();
    const res = await sendEmail({
      to: ["marcy.spear@gmail.com", "spear.cpt@gmail.com"],
      subject: "All via SMTP",
      html: "<p>body</p>",
    });
    expect(res.ok).toBe(true);
    // Resend was never called — nothing in finalList.
    expect(sendMock).not.toHaveBeenCalled();
    // Both addresses went through SMTP.
    expect(smtpSendMailMock).toHaveBeenCalledTimes(2);
    expect(res.acceptedRecipients).toEqual(
      expect.arrayContaining(["marcy.spear@gmail.com", "spear.cpt@gmail.com"]),
    );
  });

  it("reports SMTP failures in droppedRecipients when fallback can't deliver", async () => {
    process.env.MAIL_ALLOWED_RECIPIENTS = "spear.cpt@gmail.com";
    process.env.GMAIL_SMTP_USER = "sender@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "app-password";
    sendMock.mockResolvedValueOnce({ data: { id: "resend_msg_2" }, error: null });
    smtpSendMailMock.mockRejectedValueOnce(new Error("connection refused"));
    const { sendEmail } = await freshMailer();
    const res = await sendEmail({
      to: ["marcy.spear@gmail.com", "spear.cpt@gmail.com"],
      subject: "SMTP fails",
      html: "<p>body</p>",
    });
    // Resend send to verified address still succeeded so overall ok=true,
    // but Marcy is reported as dropped (SMTP failed).
    expect(res.ok).toBe(true);
    expect(res.acceptedRecipients).toEqual(["spear.cpt@gmail.com"]);
    expect(res.droppedRecipients).toEqual(["marcy.spear@gmail.com"]);
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
