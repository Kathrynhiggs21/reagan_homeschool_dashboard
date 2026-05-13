/**
 * Push 89 (2026-05-13) — Voice-print enrollment scaffold.
 *
 * Reagan-voice gate: when a Reagan-only action needs voice confirmation
 * (e.g., "Reagan, please mark complete by saying it out loud"), the
 * server mints a short-lived signed token bound to the voice-print row
 * id + intent. The token is opaque on the wire; the server holding the
 * `JWT_SECRET` (or `voice-print` rotation secret) is the only thing
 * that can mint a valid one.
 *
 * Pure module: no DB, no env reads. The caller passes the secret in.
 *
 * Token shape:  <printId>.<intent>.<expiresAtMs>.<hmacHex>
 *   - printId      positive integer (FK into voicePrints table)
 *   - intent       short alnum/underscore tag ("playback", "verify",
 *                  "enroll-confirm"). Bound into the HMAC so a playback
 *                  token can't be reused as an enroll token.
 *   - expiresAtMs  unix ms; server rejects after this point
 *   - hmacHex      sha256(secret, "<printId>.<intent>.<expiresAtMs>")
 *
 * Reagan-only enrollment rule (locked by contract):
 *   - mintEnrollAllowed(role) is true ONLY for role === "student".
 *   - Adults verify, but never enroll a voice that isn't theirs.
 *     (Mom/Grandma would enroll under their own student/editor row in
 *     a future push; for now this scaffold is Reagan-only.)
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type VoicePrintIntent = "playback" | "verify" | "enroll-confirm";

const INTENT_RE = /^[a-z][a-z0-9_-]{0,31}$/;

export function signVoicePrintToken(
  printId: number,
  intent: VoicePrintIntent,
  expiresAtMs: number,
  secret: string,
): string {
  if (!Number.isFinite(printId) || printId <= 0 || Math.floor(printId) !== printId) {
    throw new Error("printId must be a positive integer");
  }
  if (!INTENT_RE.test(intent)) {
    throw new Error(`intent must match ${INTENT_RE} (got "${intent}")`);
  }
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) {
    throw new Error("expiresAtMs must be a positive integer (ms)");
  }
  if (!secret || secret.length < 16) {
    throw new Error("secret too short (min 16 chars)");
  }
  const head = `${printId}.${intent}.${expiresAtMs}`;
  const sig = createHmac("sha256", secret).update(head).digest("hex");
  return `${head}.${sig}`;
}

export type VoicePrintVerify =
  | { ok: true; printId: number; intent: VoicePrintIntent; expiresAtMs: number }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" | "bad-intent" };

export function verifyVoicePrintToken(
  token: string,
  expectedIntent: VoicePrintIntent,
  secret: string,
  nowMs: number = Date.now(),
): VoicePrintVerify {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 4) return { ok: false, reason: "malformed" };
  const printId = Number(parts[0]);
  const intent = parts[1];
  const expiresAtMs = Number(parts[2]);
  const givenSig = parts[3];
  if (!Number.isFinite(printId) || printId <= 0) return { ok: false, reason: "malformed" };
  if (!INTENT_RE.test(intent)) return { ok: false, reason: "malformed" };
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) {
    return { ok: false, reason: "malformed" };
  }
  if (intent !== expectedIntent) return { ok: false, reason: "bad-intent" };
  const expectedSig = createHmac("sha256", secret)
    .update(`${printId}.${intent}.${expiresAtMs}`)
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
  return { ok: true, printId, intent: intent as VoicePrintIntent, expiresAtMs };
}

/** Reagan-only enrollment policy — locked by contract. */
export function mintEnrollAllowed(role: string | null | undefined): boolean {
  return role === "student";
}

/**
 * Voice-print row shape the rest of the app can reference without
 * importing drizzle directly. The DB migration that creates the table
 * will land in a follow-up push; for now this scaffold defines the
 * canonical shape so callers don't drift.
 */
export type VoicePrintRow = {
  id: number;
  userId: number;
  enrolledAt: Date;
  storageKey: string;      // S3 key returned by storagePut
  storageUrl: string;      // /manus-storage/<key>
  durationMs: number;      // length of enrollment sample
  sampleMime: string;      // audio/webm | audio/mp4 | audio/wav | audio/mpeg
  isActive: boolean;
  retiredAt: Date | null;
};

const ALLOWED_MIMES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
  "audio/m4a",
]);

export function isAllowedVoiceMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return ALLOWED_MIMES.has(mime.toLowerCase());
}

/** Enrollment sample length guard: 1.5s minimum, 15s maximum. */
export function isAllowedVoiceDurationMs(ms: number | null | undefined): boolean {
  if (!Number.isFinite(ms) || ms === null || ms === undefined) return false;
  return ms >= 1500 && ms <= 15_000;
}
