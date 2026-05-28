/**
 * server/_core/mailer.ts
 *
 * Email sender via Make webhook → Gmail (spear.cpt@gmail.com).
 * Sends one webhook call per recipient so Make receives a plain string
 * in the "to" field.
 *
 * Webhook payload per call:
 *   { to: string, subject: string, body: string, body_plain: string,
 *     attachments: Array<{url, filename}>, attachment_count: number }
 *
 * Attachments: PDF Buffers are uploaded to public CDN URLs via
 * manus-upload-file, then passed as URL objects in the webhook payload.
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

const MAKE_WEBHOOK_URL =
  process.env.EMAIL_WEBHOOK_URL ||
  "https://hook.us2.make.com/blmt1yp55lri3e884ahpmwum9k3ynecz";

/**
 * Upload a Buffer to a public CDN URL using manus-upload-file.
 * Returns the CDN URL or null on failure.
 */
async function uploadBufferToPublicUrl(
  buf: Buffer,
  filename: string,
): Promise<string | null> {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  const tmpPath = join(tmpdir(), `mailer_${randomBytes(8).toString("hex")}_${safe}`);
  try {
    await writeFile(tmpPath, buf);
    const { stdout } = await execFileAsync("manus-upload-file", [tmpPath], {
      timeout: 30_000,
    });
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
 * Send an email via Make webhook → Gmail.
 * One webhook call per recipient (plain string "to" field).
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

  // Send one webhook call per recipient
  const results: SendEmailResult[] = [];
  for (const recipient of toArray) {
    const payload = {
      to: recipient,
      subject: opts.subject,
      body: opts.html,
      body_plain: plainText,
      attachments: attachmentUrls,
      attachment_count: attachmentUrls.length,
    };
    try {
      const response = await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const msg = `Make webhook returned ${response.status} for ${recipient}: ${body.slice(0, 200)}`;
        console.error(`[mailer] ${msg}`);
        results.push({ ok: false, error: msg });
      } else {
        const respText = await response.text().catch(() => "");
        console.log(
          `[mailer] Make webhook sent to ${recipient} — status ${response.status} — ${respText.slice(0, 100)}`,
        );
        results.push({ ok: true, messageId: `make-${Date.now()}` });
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      console.error(`[mailer] Make webhook failed for ${recipient}: ${msg}`);
      results.push({ ok: false, error: msg });
    }
  }

  const allOk = results.every((r) => r.ok);
  const firstError = results.find((r) => !r.ok)?.error;
  return allOk
    ? { ok: true, messageId: results[0]?.messageId }
    : { ok: false, error: firstError };
}

/** Smoke-test: verify the Make webhook URL is reachable. */
export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _test: true, to: "", subject: "ping", body: "ping" }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? { ok: true } : { ok: false, error: `HTTP ${response.status}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}
