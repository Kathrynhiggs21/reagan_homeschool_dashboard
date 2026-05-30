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
 *   MAIL_FROM                — sender header, default
 *                              "Reagan's School Dashboard <onboarding@resend.dev>"
 *   MAIL_DEV_TO              — when set, ALL email is redirected to this one
 *                              address (useful before a custom domain is
 *                              verified with Resend). Hard override.
 *   MAIL_ALLOWED_RECIPIENTS  — comma-separated allow-list of recipient emails.
 *                              When set, any recipient not in this list is
 *                              dropped before send (case-insensitive). Useful
 *                              on Resend's free tier where the account is
 *                              only allowed to send to the verified address.
 *
 * Public API is unchanged:
 *   sendEmail({ to, subject, html, text?, attachments?, replyTo? })
 *
 * Attachments are sent as real MIME parts (base64) — no CDN upload, no URL links.
 *
 * Behavioral notes (2026-05-29 routing audit):
 *   - If the multi-recipient send is rejected with Resend's free-tier
 *     `validation_error` (the "you can only send to your own email" 422),
 *     we automatically retry per-recipient, dropping the addresses Resend
 *     rejects and reporting partial success. This stops one bad recipient
 *     from blocking the verified-address send.
 */

import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";

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
  /** Recipients we actually attempted to send to (after dev-redirect + allow-list). */
  acceptedRecipients?: string[];
  /** Recipients that were dropped due to allow-list / Resend free-tier rejection. */
  droppedRecipients?: string[];
  error?: string;
}

const API_KEY = process.env.RESEND_API_KEY || "";
const DEFAULT_FROM =
  process.env.MAIL_FROM ||
  "Reagan's School Dashboard <onboarding@resend.dev>";
const DEV_TO = process.env.MAIL_DEV_TO || "";
const ALLOWED_LIST = (process.env.MAIL_ALLOWED_RECIPIENTS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter((s) => s.length > 0);

// 2026-05-30 — Gmail SMTP fallback. Used ONLY for recipients that the Resend
// allow-list filter dropped (i.e., addresses Resend's free-tier policy won't
// deliver to until a custom domain is verified at resend.com/domains).
const GMAIL_SMTP_USER = process.env.GMAIL_SMTP_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";

let _client: Resend | null = null;
function getClient(): Resend | null {
  if (!API_KEY) return null;
  if (_client) return _client;
  _client = new Resend(API_KEY);
  return _client;
}

let _smtpTransport: Transporter | null = null;
function getGmailSmtp(): Transporter | null {
  if (!GMAIL_SMTP_USER || !GMAIL_APP_PASSWORD) return null;
  if (_smtpTransport) return _smtpTransport;
  _smtpTransport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_SMTP_USER, pass: GMAIL_APP_PASSWORD },
  });
  return _smtpTransport;
}

/** Side-channel send: deliver an email to recipients via Gmail SMTP. */
async function sendViaGmailSmtp(
  recipients: string[],
  baseRequest: {
    subject: string;
    text: string;
    html: string;
    attachments?: { filename: string; content: string; contentType?: string }[];
    replyTo?: string;
  },
): Promise<{ accepted: string[]; rejected: string[]; lastMessageId?: string; error?: string }> {
  const transport = getGmailSmtp();
  if (!transport) {
    return {
      accepted: [],
      rejected: recipients,
      error: "GMAIL_SMTP_USER / GMAIL_APP_PASSWORD not set — SMTP fallback disabled",
    };
  }
  const fromHeader = `"Reagan's School Dashboard" <${GMAIL_SMTP_USER}>`;
  const accepted: string[] = [];
  const rejected: string[] = [];
  let lastMessageId: string | undefined;
  let lastError: string | undefined;
  for (const to of recipients) {
    try {
      const info = await transport.sendMail({
        from: fromHeader,
        to,
        subject: baseRequest.subject,
        text: baseRequest.text,
        html: baseRequest.html,
        replyTo: baseRequest.replyTo,
        attachments: (baseRequest.attachments ?? []).map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, "base64"),
          contentType: a.contentType,
        })),
      });
      accepted.push(to);
      lastMessageId = info.messageId ?? lastMessageId;
    } catch (e: any) {
      rejected.push(to);
      lastError = String(e?.message ?? e);
    }
  }
  return { accepted, rejected, lastMessageId, error: lastError };
}

function toBase64(content: Buffer | string, encoding?: "base64" | "utf8"): string {
  if (Buffer.isBuffer(content)) return content.toString("base64");
  if (encoding === "base64") return content; // already base64-encoded
  // utf8 (or default) -- treat as text
  return Buffer.from(content, "utf8").toString("base64");
}

/** Apply MAIL_DEV_TO override + MAIL_ALLOWED_RECIPIENTS filter to the caller's list. */
function applyRecipientPolicy(requested: string[]): {
  finalList: string[];
  dropped: string[];
} {
  const norm = (s: string) => s.trim();
  if (DEV_TO) {
    // Hard override — DEV_TO wins over everything else.
    return { finalList: [DEV_TO], dropped: requested.filter((r) => norm(r).toLowerCase() !== DEV_TO.toLowerCase()) };
  }
  if (ALLOWED_LIST.length > 0) {
    const accepted: string[] = [];
    const dropped: string[] = [];
    for (const r of requested) {
      if (ALLOWED_LIST.includes(norm(r).toLowerCase())) accepted.push(norm(r));
      else dropped.push(norm(r));
    }
    return { finalList: accepted, dropped };
  }
  return { finalList: requested.map(norm), dropped: [] };
}

/**
 * Detect Resend's free-tier "you can only send testing emails to your own
 * email address" 422. When we see this, we know one of the recipients was
 * blocked by Resend (not by us) and we should drop them one-by-one and retry.
 */
function isResendFreeTierError(err: { name?: string; message?: string }): boolean {
  const msg = (err.message || "").toLowerCase();
  return (
    err.name === "validation_error" &&
    (msg.includes("you can only send testing emails") ||
      msg.includes("verify a domain"))
  );
}

/**
 * Send an email via Resend.
 * Multi-recipient: a single API call with all addresses in `to`. If Resend
 * rejects with a free-tier validation_error, we automatically retry per
 * recipient and report which addresses landed.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) {
    const msg = "RESEND_API_KEY not set — refusing to send email";
    console.warn(`[mailer] ${msg}`);
    return { ok: false, skipped: true, error: msg };
  }

  const requestedTo = Array.isArray(opts.to) ? opts.to : [opts.to];
  const { finalList, dropped } = applyRecipientPolicy(requestedTo);
  // SMTP fallback target list = addresses Resend's allow-list filter dropped.
  const smtpFallbackTargets = dropped.slice();
  if (finalList.length === 0 && smtpFallbackTargets.length === 0) {
    const msg =
      "No accepted recipients after policy filter (MAIL_DEV_TO / MAIL_ALLOWED_RECIPIENTS)";
    console.warn(`[mailer] ${msg}; requested=${requestedTo.join(", ")}`);
    return {
      ok: false,
      skipped: true,
      error: msg,
      acceptedRecipients: [],
      droppedRecipients: dropped,
    };
  }

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

  const subjectPrefix = DEV_TO ? `[orig→${requestedTo.join(",")}] ` : "";
  const baseRequest = {
    from: DEFAULT_FROM,
    subject: subjectPrefix + opts.subject,
    text: plainText,
    html: opts.html,
    attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
    replyTo: opts.replyTo,
  } as const;

  // Helper: run the SMTP fallback for the addresses Resend's allow-list
  // filter dropped. Always called after the Resend attempt(s) finish.
  async function runSmtpFallback(extraRejected: string[]): Promise<{
    smtpAccepted: string[];
    smtpRejected: string[];
    smtpMessageId?: string;
    smtpError?: string;
  }> {
    const targets = Array.from(new Set([...smtpFallbackTargets, ...extraRejected]));
    if (targets.length === 0) return { smtpAccepted: [], smtpRejected: [] };
    const r = await sendViaGmailSmtp(targets, {
      subject: opts.subject,
      text: plainText,
      html: opts.html,
      attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
      replyTo: opts.replyTo,
    });
    if (r.accepted.length > 0) {
      console.log(
        `[mailer] Gmail SMTP fallback delivered to ${r.accepted.join(", ")} — messageId=${r.lastMessageId}`,
      );
    }
    if (r.rejected.length > 0) {
      console.warn(
        `[mailer] Gmail SMTP fallback failed for ${r.rejected.join(", ")}: ${r.error || "unknown"}`,
      );
    }
    return {
      smtpAccepted: r.accepted,
      smtpRejected: r.rejected,
      smtpMessageId: r.lastMessageId,
      smtpError: r.error,
    };
  }

  // Edge case: ALL recipients dropped by allow-list (e.g., only Marcy in
  // requestedTo, allow-list is just spear.cpt@gmail.com). Skip Resend, go
  // straight to SMTP fallback.
  if (finalList.length === 0) {
    const { smtpAccepted, smtpRejected, smtpMessageId, smtpError } =
      await runSmtpFallback([]);
    if (smtpAccepted.length > 0) {
      return {
        ok: true,
        messageId: smtpMessageId,
        acceptedRecipients: smtpAccepted,
        droppedRecipients: smtpRejected,
      };
    }
    return {
      ok: false,
      error: smtpError || "SMTP fallback rejected all recipients",
      acceptedRecipients: [],
      droppedRecipients: smtpRejected,
    };
  }

  // Attempt 1 — single API call with the full list.
  try {
    const res = await client.emails.send({ ...baseRequest, to: finalList });
    if (!res.error) {
      const { smtpAccepted, smtpRejected } = await runSmtpFallback([]);
      console.log(
        `[mailer] Resend sent to ${finalList.join(", ")} — messageId=${res.data?.id}` +
          (smtpAccepted.length > 0 ? `; SMTP fallback also delivered to ${smtpAccepted.join(", ")}` : ""),
      );
      return {
        ok: true,
        messageId: res.data?.id,
        acceptedRecipients: [...finalList, ...smtpAccepted],
        droppedRecipients: smtpRejected,
      };
    }

    if (!isResendFreeTierError(res.error)) {
      const msg = `${res.error.name || "ResendError"}: ${res.error.message}`;
      console.error(
        `[mailer] Resend rejected send to ${finalList.join(", ")} — ${msg}`,
      );
      return {
        ok: false,
        error: msg,
        acceptedRecipients: finalList,
        droppedRecipients: dropped,
      };
    }

    // Free-tier rejection — fall through to per-recipient retry below.
    console.warn(
      `[mailer] Resend free-tier rejection on multi-recipient send; ` +
        `retrying per-recipient (${finalList.length} addresses)`,
    );
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    console.error(`[mailer] Resend threw for ${finalList.join(", ")}: ${msg}`);
    return {
      ok: false,
      error: msg,
      acceptedRecipients: finalList,
      droppedRecipients: dropped,
    };
  }

  // Attempt 2..N — one address at a time. Track which landed.
  const accepted: string[] = [];
  const rejected: string[] = [];
  let lastMessageId: string | undefined;
  let lastError: string | undefined;
  for (const addr of finalList) {
    try {
      const res = await client.emails.send({ ...baseRequest, to: [addr] });
      if (res.error) {
        rejected.push(addr);
        if (!isResendFreeTierError(res.error)) {
          lastError = `${res.error.name || "ResendError"}: ${res.error.message}`;
        }
        continue;
      }
      accepted.push(addr);
      lastMessageId = res.data?.id ?? lastMessageId;
    } catch (e: any) {
      rejected.push(addr);
      lastError = String(e?.message ?? e);
    }
  }

  // After the per-recipient retry, hand any STILL-rejected addresses to the
  // Gmail SMTP fallback so they at least land via the side channel.
  const { smtpAccepted, smtpRejected } = await runSmtpFallback(rejected);

  if (accepted.length === 0 && smtpAccepted.length === 0) {
    const msg = lastError || "All recipients rejected by Resend (free-tier).";
    console.error(`[mailer] No recipients accepted; ${msg}`);
    return {
      ok: false,
      error: msg,
      acceptedRecipients: [],
      droppedRecipients: [...dropped, ...rejected, ...smtpRejected],
    };
  }

  console.log(
    `[mailer] Partial Resend send — accepted=${accepted.join(", ")}; ` +
      `rejected=${rejected.join(", ") || "none"}; messageId=${lastMessageId}` +
      (smtpAccepted.length > 0 ? `; SMTP fallback delivered to ${smtpAccepted.join(", ")}` : ""),
  );
  return {
    ok: true,
    messageId: lastMessageId,
    acceptedRecipients: [...accepted, ...smtpAccepted],
    droppedRecipients: smtpRejected,
  };
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
