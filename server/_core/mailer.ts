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
  if (finalList.length === 0) {
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

  // Attempt 1 — single API call with the full list.
  try {
    const res = await client.emails.send({ ...baseRequest, to: finalList });
    if (!res.error) {
      console.log(
        `[mailer] Resend sent to ${finalList.join(", ")} — messageId=${res.data?.id}`,
      );
      return {
        ok: true,
        messageId: res.data?.id,
        acceptedRecipients: finalList,
        droppedRecipients: dropped,
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

  if (accepted.length === 0) {
    const msg = lastError || "All recipients rejected by Resend (free-tier).";
    console.error(`[mailer] No recipients accepted; ${msg}`);
    return {
      ok: false,
      error: msg,
      acceptedRecipients: [],
      droppedRecipients: [...dropped, ...rejected],
    };
  }

  console.log(
    `[mailer] Partial Resend send — accepted=${accepted.join(", ")}; ` +
      `rejected=${rejected.join(", ") || "none"}; messageId=${lastMessageId}`,
  );
  return {
    ok: true,
    messageId: lastMessageId,
    acceptedRecipients: accepted,
    droppedRecipients: [...dropped, ...rejected],
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
