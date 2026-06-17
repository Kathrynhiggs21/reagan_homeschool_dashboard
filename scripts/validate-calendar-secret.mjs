// Validates GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON from the project env by minting
// a Calendar token and probing read + write on the Reagan Homeschool calendar.
// Reads the secret the same way the app does (process.env).
import crypto from "node:crypto";

const CAL_ID = "o81tqeb4425ej2k9il7lhmooh4@group.calendar.google.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_SCOPE = "https://www.googleapis.com/auth/calendar";

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function mint(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = { iss: sa.client_email, scope: CAL_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const sig = b64url(signer.sign(sa.private_key.replace(/\\n/g, "\n")));
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }).toString(),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`mint failed ${res.status}: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function main() {
  const raw = (process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) { console.log("RESULT: NO_SECRET (env not set)"); process.exit(2); }
  const sa = JSON.parse(raw);
  console.log("SA email:", sa.client_email);
  const token = await mint(sa);
  console.log("Token mint: OK");

  const metaRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}`, { headers: { Authorization: `Bearer ${token}` } });
  const meta = await metaRes.json();
  console.log("READ calendar:", metaRes.status, meta.summary || meta.error?.message || "");

  const insRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ summary: "[Reagan Homeschool] write-check (auto-deletes)", start: { dateTime: "2026-06-20T07:00:00-04:00" }, end: { dateTime: "2026-06-20T07:10:00-04:00" }, description: "reaganHomeschoolSync=writecheck" }),
  });
  const ins = await insRes.json();
  if (insRes.ok && ins.id) {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events/${ins.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    console.log("WRITE check: OK (insert+delete succeeded)");
    console.log("RESULT: WRITE_READY");
  } else {
    console.log("WRITE check:", insRes.status, ins.error?.message || JSON.stringify(ins).slice(0, 160));
    console.log("RESULT: READ_ONLY_NEEDS_SHARING");
  }
  process.exit(0);
}

main().catch((e) => { console.error("ERROR:", e.message); console.log("RESULT: ERROR"); process.exit(1); });
