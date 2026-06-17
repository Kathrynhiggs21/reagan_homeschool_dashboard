// Live test: mint a Google access token from the service-account key and
// probe access to the Reagan Homeschool calendar (read + a throwaway write).
// Usage: node scripts/test-sa-calendar.mjs <sa-json-path>
import fs from "node:fs";
import crypto from "node:crypto";

const SA_PATH = process.argv[2];
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
  const assertion = `${unsigned}.${sig}`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`mint failed ${res.status}: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function main() {
  const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf8"));
  console.log("SA email:", sa.client_email);
  const token = await mint(sa);
  console.log("Minted access token OK (len", token.length, ")");

  // 1) Try to READ the target calendar's metadata.
  const metaRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const meta = await metaRes.json();
  console.log("GET calendar meta:", metaRes.status, meta.summary || meta.error?.message || JSON.stringify(meta).slice(0, 200));

  // 2) Try a throwaway WRITE (insert), then delete it, to confirm writer access.
  if (metaRes.ok) {
    const insRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: "[Reagan Homeschool] connectivity test — safe to delete",
          start: { dateTime: "2026-06-20T09:00:00-04:00" },
          end: { dateTime: "2026-06-20T09:15:00-04:00" },
          description: "reaganHomeschoolSync=probe",
        }),
      },
    );
    const ins = await insRes.json();
    console.log("INSERT test event:", insRes.status, ins.id || ins.error?.message || JSON.stringify(ins).slice(0, 200));
    if (insRes.ok && ins.id) {
      const delRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events/${ins.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      console.log("DELETE test event:", delRes.status);
    }
  }

  // 3) Also test the SA's own primary calendar list (sanity).
  const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = await listRes.json();
  const ids = (list.items || []).map((c) => `${c.id} (${c.accessRole})`);
  console.log("calendarList:", listRes.status, ids.length ? ids : list.error?.message || "(empty)");

  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
