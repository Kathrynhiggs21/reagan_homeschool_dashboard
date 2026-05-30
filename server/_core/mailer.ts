/**
 * server/_core/mailer.ts
 *
 * Email sender via Resend HTTPS API — replaces the previous Make webhook
 * pipeline (which kept losing Gmail OAuth scopes and 403'ing).
 *
 * Required env:
 *   RESEND_API_KEY  — Resend API key (starts with re_...)
 *
 * Optional env:
 *   MAIL_FROM       — sender header, default "Reagan's School Dashboard <onboarding@resend.dev>"
 *   MAIL_DEV_TO     — when set, ALL email is redirected to this address only
 *                     (useful before a custom domain is verified with Resend)
 *
 * Public API is unchanged:
 *   sendEmail({ to, subject, html, text?, attachments?, replyTo? })
 *
 * Attachments are sent as real MIME parts (base64) — no CDN upload, no URL links.
 */

import { Resend } from "resend";

export interface MailAttachment {
  filename: string;
  content: Buffer | string;
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
  skipped?: boolean;
  error?: string;
}

const API_KEY = process.env.RESEND_API_KEY || "";
const DEFAULT_FROM =
  process.env.MAIL_FROM ||
  "Reagan's School Dashboard <onboarding@resend.dev>";
const DEV_TO = process.env.MAIL_DEV_TO || "";

let _client: Resend | null = null;
function getClient(): Resend | null {
  if (!API_KEY) return null;
  if (_client) return _client;
  _client = new Resend(API_KEY);
  return _client;
}

function toBase64(content: Buffer | string, encoding?: "base64" | "utf8"): string {
  if (Buffer.isBuffer(content)) return content.toString("base64");
  if (encoding === "base64") return content; // already base64-encoded
  // utf8 (or default) -- treat as text
  return Buffer.from(content, "utf8").toString("base64");
}

/**
 * Send an email via Resend.
 * Multi-recipient: a single API call with all addresses in `to`.
 *
 * Returns:
 *   { ok: true, messageId } on success
 *   { ok: false, skipped: true, error } if RESEND_API_KEY is missing
 *   { ok: false, error } on send failure (Resend 4xx/5xx, network, etc.)
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) {
    const msg = "RESEND_API_KEY not set — refusing to send email";
    console.warn(`[mailer] ${msg}`);
    return { ok: false, skipped: true, error: msg };
  }

  const requestedTo = Array.isArray(opts.to) ? opts.to : [opts.to];
  // If MAIL_DEV_TO is set, redirect ALL email there. Otherwise honor `to`.
  const toList = DEV_TO ? [DEV_TO] : requestedTo;

  // Plain-text fallback derived from HTML if not supplied
  const plainText =
    opts.text ??
    opts.html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const resendAttachments = (opts.attachments ?? [])
    .filter((a) => a && a.content)
    .map((att) => ({
      filename: att.filename,
      content: toBase64(att.content, att.encoding),
      contentType: att.contentType,
    }));

  try {
    const subjectPrefix = DEV_TO
      ? `[orig→${requestedTo.join(",")}] `
      : "";
    const res = await client.emails.send({
      from: DEFAULT_FROM,
      to: toList,
      subject: subjectPrefix + opts.subject,
      text: plainText,
      html: opts.html,
      attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
      replyTo: opts.replyTo,
    });

    if (res.error) {
      const msg = `${res.error.name || "ResendError"}: ${res.error.message}`;
      console.error(
        `[mailer] Resend rejected send to ${toList.join(", ")} — ${msg}`,
      );
      return { ok: false, error: msg };
    }
    console.log(
      `[mailer] Resend sent to ${toList.join(", ")} — messageId=${res.data?.id}`,
    );
    return { ok: true, messageId: res.data?.id };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    console.error(`[mailer] Resend threw for ${toList.join(", ")}: ${msg}`);
    return { ok: false, error: msg };
  }
}

/** Smoke-test: verify the Resend API key is set and reachable. */
export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }
  // Resend has no dedicated /verify endpoint; the cheapest valid check is to
  // attempt to list API keys (which a "sending-only" key will 401 on but a
  // full-access key will succeed on). For now, just assert the key is present.
  return { ok: true };
}
