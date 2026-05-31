/**
 * Drainer-token mint / verify (v3.23, 2026-05-31)
 * ===============================================
 *
 * Lets the Drive connector drainer authenticate to the dashboard without
 * needing the admin session cookie. The admin clicks "Copy drain command"
 * on the Settings card; the dashboard mints a short-lived HMAC-signed
 * token; the drainer passes the token as an input to
 * `connectorPlanWithToken` / `connectorReportWithToken`; the dashboard
 * verifies the HMAC + expiry + audience and processes the request.
 *
 * Token format
 * ------------
 * `dt1.<payloadB64>.<sigB64>` where:
 *   - `dt1` is the format tag (drainer-token v1)
 *   - `payloadB64` = base64url-no-pad JSON of {sub, iat, exp, aud, nonce}
 *   - `sigB64` = base64url-no-pad HMAC-SHA256(secret, `dt1.<payloadB64>`)
 *
 * Why HMAC instead of a JWT library
 * ---------------------------------
 * No dependency, no surprise key-discovery code paths, no kid/alg
 * negotiation. The drainer just gets a flat opaque string and posts it.
 *
 * Secret
 * ------
 * Uses `JWT_SECRET` (already in env) — separate audience tag prevents
 * cross-use with session JWTs.
 *
 * Lifetime
 * --------
 * Default 15 minutes; configurable per mint up to 60 minutes. A drain run
 * is fast (queue is small), so we don't need long lifetimes.
 *
 * Tests live in `server/drainerToken.test.ts`.
 */

import crypto from "node:crypto";

export const DRAINER_TOKEN_TAG = "dt1" as const;
export const DRAINER_TOKEN_AUDIENCE = "drive-connector-drainer" as const;
export const DRAINER_TOKEN_MAX_TTL_SECONDS = 60 * 60; // 60 minutes
export const DRAINER_TOKEN_DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes

export type DrainerTokenPayload = {
  /** Subject — admin user's openId. */
  sub: string;
  /** Issued-at, unix seconds. */
  iat: number;
  /** Expiry, unix seconds. */
  exp: number;
  /** Audience — must equal DRAINER_TOKEN_AUDIENCE. */
  aud: typeof DRAINER_TOKEN_AUDIENCE;
  /** Random nonce so two mints in the same second don't collide. */
  nonce: string;
};

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "drainerToken: JWT_SECRET is missing or too short (need ≥16 chars)",
    );
  }
  return s;
}

/**
 * Mint a fresh drainer token for `sub` (the admin user's openId). The
 * token is HMAC-signed with `JWT_SECRET` and is valid for `ttlSeconds`
 * (default 15 min, max 60 min). Returns the opaque token string the
 * caller surfaces to the admin.
 */
export function mintDrainerToken(
  sub: string,
  opts: { ttlSeconds?: number; now?: number } = {},
): string {
  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error("drainerToken.mint: sub is required");
  }
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  const ttl = Math.max(
    30,
    Math.min(
      DRAINER_TOKEN_MAX_TTL_SECONDS,
      opts.ttlSeconds ?? DRAINER_TOKEN_DEFAULT_TTL_SECONDS,
    ),
  );
  const payload: DrainerTokenPayload = {
    sub,
    iat: nowSec,
    exp: nowSec + ttl,
    aud: DRAINER_TOKEN_AUDIENCE,
    nonce: crypto.randomBytes(8).toString("hex"),
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const signedPart = `${DRAINER_TOKEN_TAG}.${payloadB64}`;
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(signedPart)
    .digest();
  const sigB64 = b64urlEncode(sig);
  return `${signedPart}.${sigB64}`;
}

export type DrainerTokenVerifyResult =
  | { ok: true; payload: DrainerTokenPayload }
  | { ok: false; reason: string };

/**
 * Verify a drainer token. Returns the parsed payload on success or a
 * machine-readable reason on failure. Never throws on malformed input —
 * the caller surfaces the reason to logs / 401 responses.
 */
export function verifyDrainerToken(
  token: unknown,
  opts: { now?: number } = {},
): DrainerTokenVerifyResult {
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "token-missing" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false, reason: "token-malformed-parts" };
  }
  const [tag, payloadB64, sigB64] = parts;
  if (tag !== DRAINER_TOKEN_TAG) {
    return { ok: false, reason: "token-wrong-tag" };
  }
  // Recompute the expected signature.
  let expectedSig: Buffer;
  try {
    expectedSig = crypto
      .createHmac("sha256", getSecret())
      .update(`${tag}.${payloadB64}`)
      .digest();
  } catch (e) {
    return { ok: false, reason: `token-hmac-error: ${(e as Error).message}` };
  }
  let providedSig: Buffer;
  try {
    providedSig = b64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "token-bad-sig-b64" };
  }
  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(providedSig, expectedSig)
  ) {
    return { ok: false, reason: "token-bad-signature" };
  }
  // Signature OK — now decode + validate payload.
  let payload: DrainerTokenPayload;
  try {
    const json = b64urlDecode(payloadB64).toString("utf8");
    payload = JSON.parse(json) as DrainerTokenPayload;
  } catch {
    return { ok: false, reason: "token-bad-payload-json" };
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    typeof payload.nonce !== "string" ||
    payload.aud !== DRAINER_TOKEN_AUDIENCE
  ) {
    return { ok: false, reason: "token-payload-shape" };
  }
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  if (payload.exp <= nowSec) {
    return { ok: false, reason: "token-expired" };
  }
  if (payload.iat > nowSec + 60) {
    // Allow 60s of clock skew before treating an iat as future.
    return { ok: false, reason: "token-issued-in-future" };
  }
  return { ok: true, payload };
}

/**
 * Format a friendly human-readable lifetime for the Settings card. Pure.
 * `"15 min"`, `"1 hr"`, etc.
 */
export function formatDrainerTokenLifetime(ttlSeconds: number): string {
  const t = Math.max(0, Math.floor(ttlSeconds));
  if (t < 60) return `${t} sec`;
  if (t < 60 * 60) return `${Math.floor(t / 60)} min`;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
