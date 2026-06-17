/**
 * Google access-token resolver for the Calendar sync worker.
 * ==========================================================
 *
 * Two supported credential shapes (matching the credential gate in
 * googleCalendarSync.ts):
 *
 *   1. OAuth token  — env GOOGLE_CALENDAR_OAUTH_TOKEN (or the unified
 *      GOOGLE_DRIVE_OAUTH_TOKEN). May be EITHER a ready-to-use access
 *      token, OR a JSON blob { access_token, refresh_token, client_id,
 *      client_secret, expiry? }. When a refresh_token + client creds are
 *      present we refresh against Google's token endpoint so a stale
 *      access token self-heals.
 *
 *   2. Service account — env GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON: a
 *      standard service-account JSON. We mint a short-lived access token
 *      via the JWT-bearer flow (RS256 assertion). Calendar scope.
 *
 * Pure-ish: only touches the network when it actually needs to mint or
 * refresh a token. A bare access-token string returns immediately.
 */
import crypto from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_SCOPE = "https://www.googleapis.com/auth/calendar";

type ResolvedToken = { accessToken: string; source: string };

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Try to parse a string as JSON; return null on failure. */
function tryParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Refresh an OAuth access token using a refresh_token + client creds.
 */
async function refreshOAuth(
  obj: { refresh_token: string; client_id: string; client_secret: string },
  fetchImpl: typeof fetch,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: obj.refresh_token,
    client_id: obj.client_id,
    client_secret: obj.client_secret,
  });
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(
      `OAuth refresh failed (${res.status}): ${json.error_description || json.error || "unknown"}`,
    );
  }
  return json.access_token as string;
}

/**
 * Mint an access token from a service-account JSON via the JWT-bearer
 * flow. RS256-signs the assertion with the SA private key.
 */
async function mintServiceAccountToken(
  sa: { client_email: string; private_key: string },
  fetchImpl: typeof fetch,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: CAL_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(sa.private_key.replace(/\\n/g, "\n")));
  const assertion = `${unsigned}.${signature}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Service-account token mint failed (${res.status}): ${json.error_description || json.error || "unknown"}`,
    );
  }
  return json.access_token as string;
}

/**
 * Resolve a usable Calendar access token from env. Throws a clear error
 * if nothing usable is configured (callers should consult
 * getCalendarCredentialStatus first to avoid this in the no-cred path).
 */
export async function resolveCalendarAccessToken(
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedToken> {
  // 1. OAuth token env (Calendar-specific, then unified Drive).
  const rawOAuth =
    (process.env.GOOGLE_CALENDAR_OAUTH_TOKEN || "").trim() ||
    (process.env.GOOGLE_DRIVE_OAUTH_TOKEN || "").trim();

  if (rawOAuth) {
    const parsed = tryParse(rawOAuth);
    if (parsed && typeof parsed === "object") {
      // JSON blob. Prefer refresh if we have the pieces (self-healing).
      if (parsed.refresh_token && parsed.client_id && parsed.client_secret) {
        const accessToken = await refreshOAuth(parsed, fetchImpl);
        return { accessToken, source: "oauth_refresh" };
      }
      if (parsed.access_token) {
        return { accessToken: parsed.access_token, source: "oauth_token_json" };
      }
    }
    // Bare token string.
    return { accessToken: rawOAuth, source: "oauth_token_bare" };
  }

  // 2. Service-account JSON.
  const rawSa = (process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON || "").trim();
  if (rawSa) {
    const sa = tryParse(rawSa);
    if (sa && sa.client_email && sa.private_key) {
      const accessToken = await mintServiceAccountToken(sa, fetchImpl);
      return { accessToken, source: "service_account" };
    }
    throw new Error(
      "GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON is set but malformed (missing client_email/private_key).",
    );
  }

  throw new Error(
    "No Calendar credentials configured. Set GOOGLE_CALENDAR_OAUTH_TOKEN or GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON.",
  );
}
