/**
 * Push 77 (2026-05-13) — SMS approval signed-token helpers.
 *
 * When a risky change is queued in `pendingApprovals`, an SMS goes to
 * Mom (and optionally Grandma) with a short link of the form:
 *
 *   https://reagan.…/approve?t=<token>
 *
 * The token is `<approvalId>.<expiresAtMs>.<hmacHex>`. Anyone with the
 * link can approve, so the HMAC is what keeps it secure — only the server
 * holding `JWT_SECRET` can mint a valid token, and tampering with the id
 * or expiry breaks the signature.
 *
 * Pure module: no DB, no env reads. The caller passes the secret in.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type SmsApprovalToken = string;

export function signSmsApprovalToken(
  approvalId: number,
  expiresAtMs: number,
  secret: string,
): SmsApprovalToken {
  if (!Number.isFinite(approvalId) || approvalId <= 0) {
    throw new Error("approvalId must be a positive integer");
  }
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) {
    throw new Error("expiresAtMs must be a positive integer (ms)");
  }
  if (!secret || secret.length < 16) {
    throw new Error("secret too short (min 16 chars)");
  }
  const head = `${approvalId}.${expiresAtMs}`;
  const sig = createHmac("sha256", secret).update(head).digest("hex");
  return `${head}.${sig}`;
}

export type VerifyResult =
  | { ok: true; approvalId: number; expiresAtMs: number }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

export function verifySmsApprovalToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): VerifyResult {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const approvalId = Number(parts[0]);
  const expiresAtMs = Number(parts[1]);
  const givenSig = parts[2];
  if (!Number.isFinite(approvalId) || approvalId <= 0) {
    return { ok: false, reason: "malformed" };
  }
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) {
    return { ok: false, reason: "malformed" };
  }
  const expectedSig = createHmac("sha256", secret)
    .update(`${approvalId}.${expiresAtMs}`)
    .digest("hex");
  let sigOk = false;
  try {
    const a = Buffer.from(givenSig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    sigOk = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { ok: false, reason: "bad-signature" };
  if (nowMs >= expiresAtMs) return { ok: false, reason: "expired" };
  return { ok: true, approvalId, expiresAtMs };
}
