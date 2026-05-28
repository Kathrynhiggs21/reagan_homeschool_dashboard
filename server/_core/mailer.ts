/**
 * server/_core/mailer.ts
 *
 * Email sender via Zapier webhook.
 * The Zapier Zap receives a POST with { to, subject, body, attachments[] }
 * and sends the email via Gmail (spear.cpt@gmail.com).
 *
 * No SMTP app passwords needed. Fully automated — no confirmation required.
 *
 * Required env var:
 *   ZAPIER_EMAIL_WEBHOOK_URL — Zapier "Catch Hook" webhook URL
 *
 * Attachments: PDF buffers are uploaded to public CDN URLs via
 * manus-upload-file, then passed as attachment URLs in the webhook payload.
 * Zapier's Gmail action supports attachment URLs natively.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

const execFileAsync = promisify(execFile);

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

const ZAPIER_WEBHOOK_URL =
  process.env.ZAPIER_EMAIL_WEBHOOK_URL ||
  "https://hooks.zapier.com/hooks/catch/11025978/4b2jboq/";

/**
 * Upload a Buffer to a public CDN URL using manus-upload-file.
 * Returns the CDN URL or null on failure.
 */
async function uploadBufferToPublicUrl(buf: Buffer, filename: string): Promise<string | null> {
  const tmpPath = join(
    tmpdir(),
    `mailer_${randomBytes(8).toString("hex")}_${filename.replace(/[^A-Za-z0-9._-]/g, "_")}`,
  );
  try {
    await writeFile(tmpPath, buf);
    const { stdout } = await execFileAsync("manus-upload-file", [tmpPath], { timeout: 30_000 });
    // Extract CDN URL from output like: "CDN URL: https://files.manuscdn.com/..."
    const match = stdout.match(/CDN URL:\s*(https?:\/\/\S+)/);
    return match ? match[1].trim() : null;
  } catch (e: any) {
    console.warn(`[mailer] upload failed for ${filename}: ${String(e?.message ?? e)}`);
    return null;
  } finally {
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Send an email via Zapier webhook → Gmail.
 * Fully automated — no confirmation required.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const toArray = Array.isArray(opts.to) ? opts.to : [opts.to];

  // Upload PDF attachments to public CDN URLs
  const attachmentUrls: Array<{ url: string; filename: string }> = [];
  for (const att of opts.attachments ?? []) {
    if (!att.content || typeof att.content === "string") continue;
    const url = await uploadBufferToPublicUrl(att.content as Buffer, att.filename);
    if (url) {
      attachmentUrls.push({ url, filename: att.filename });
    }
  }

  // Plain-text fallback
  const plainText =
    opts.text ?? opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const payload = {
    to: toArray.join(", "),
    subject: opts.subject,
    body: opts.html,
    body_plain: plainText,
    attachments: attachmentUrls,
    attachment_count: attachmentUrls.length,
  };

  try {
    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const msg = `Zapier webhook returned ${response.status}: ${body.slice(0, 200)}`;
      console.error(`[mailer] ${msg}`);
      return { ok: false, error: msg };
    }

    const respText = await response.text().catch(() => "");
    console.log(
      `[mailer] Zapier webhook sent to ${toArray.join(", ")} — status ${response.status} — ${respText.slice(0, 100)}`,
    );
    return { ok: true, messageId: `zapier-${Date.now()}` };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    console.error(`[mailer] Zapier webhook failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

/** Smoke-test: verify the Zapier webhook URL is reachable. */
export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _test: true, to: "", subject: "ping", body: "ping" }),
      signal: AbortSignal.timeout(10_000),
    });
    // Zapier returns 200 even for test pings
    return response.ok
      ? { ok: true }
      : { ok: false, error: `HTTP ${response.status}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}
