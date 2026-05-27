/**
 * server/_core/mailer.ts
 *
 * Self-contained email sender using Nodemailer + Gmail SMTP.
 * Replaces the broken "return payload for external agent to send" pattern.
 *
 * Required env vars:
 *   GMAIL_SMTP_USER     — Gmail address (e.g. spear.cpt@gmail.com)
 *   GMAIL_APP_PASSWORD  — Gmail App Password (16-char, no spaces)
 *                         Generate at: myaccount.google.com/apppasswords
 *
 * If either env var is missing, sendEmail() returns { ok: false, skipped: true }
 * so the caller can fall back gracefully without crashing.
 */

import nodemailer from "nodemailer";

export interface MailAttachment {
  filename: string;
  content: Buffer | string; // Buffer for binary (PDF), string for text
  contentType?: string;
  encoding?: "base64" | "utf8";
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  skipped?: boolean; // true when SMTP creds are not configured
  error?: string;
}

function createTransport() {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { type: "LOGIN", user, pass },
  });
}

/**
 * Send an email via Gmail SMTP.
 * Returns { ok: false, skipped: true } when SMTP creds are not configured.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[mailer] GMAIL_SMTP_USER or GMAIL_APP_PASSWORD not set — email skipped.");
    return { ok: false, skipped: true };
  }

  const toArray = Array.isArray(opts.to) ? opts.to : [opts.to];
  const toStr = toArray.join(", ");

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Reagan's School Dashboard" <${process.env.GMAIL_SMTP_USER}>`,
    to: toStr,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    replyTo: opts.replyTo,
    attachments: (opts.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType ?? "application/octet-stream",
      encoding: a.encoding,
    })),
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`[mailer] sent to ${toStr} — messageId: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    console.error(`[mailer] send failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

/** Quick smoke-test: verify the SMTP transport can connect (no email sent). */
export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  const transport = createTransport();
  if (!transport) return { ok: false, error: "SMTP credentials not configured" };
  try {
    await transport.verify();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}
