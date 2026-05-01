import { describe, it, expect } from "vitest";

/**
 * PowerSchool login validation
 *
 * Validates POWERSCHOOL_PARENT_USERNAME / POWERSCHOOL_PARENT_PASSWORD by
 * performing the same form POST the IH guardian portal does:
 *   1. GET /public/home.html       → harvest pstoken + contextData (anti-CSRF inputs)
 *   2. POST /guardian/home.html    → with the encoded credential and the harvested tokens
 *   3. Confirm response sets a session cookie + lands us on guardian/home (not the login page)
 *
 * If credentials are bad we'll get bounced back to the login page and the
 * `account="bad"` query param shows up — we fail loudly so the user knows.
 */

const BASE = "https://indianhill.powerschool.com";
const TIMEOUT_MS = 20_000;

function pickCookie(headers: Headers): string {
  const all = headers.getSetCookie?.() ?? [];
  return all.map((c) => c.split(";")[0]).join("; ");
}

function extractInput(html: string, name: string): string | null {
  const re = new RegExp(`<input[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["']`, "i");
  const alt = new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["']`, "i");
  return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null;
}

// IH PowerSchool guardian account was closed April 2026 when Reagan transitioned
// to full-time homeschool. The live POST is no longer reachable / authenticated,
// so we skip the live-login test instead of letting it fail every CI run.
describe.skip("PowerSchool guardian credentials (archived — IH closed Apr 2026)", () => {
  it(
    "logs in successfully with the stored secrets",
    async () => {
      const username = process.env.POWERSCHOOL_PARENT_USERNAME;
      const password = process.env.POWERSCHOOL_PARENT_PASSWORD;
      expect(username, "POWERSCHOOL_PARENT_USERNAME must be set").toBeTruthy();
      expect(password, "POWERSCHOOL_PARENT_PASSWORD must be set").toBeTruthy();

      // 1. Fetch the login page to grab pstoken + contextData
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const loginPage = await fetch(`${BASE}/public/home.html`, {
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 ReaganDashboard/1.0" },
      });
      clearTimeout(t);
      expect(loginPage.ok, "login page reachable").toBe(true);
      const cookies1 = pickCookie(loginPage.headers);
      const html = await loginPage.text();
      const pstoken = extractInput(html, "pstoken");
      const contextData = extractInput(html, "contextData");
      expect(pstoken, "pstoken on login page").toBeTruthy();
      expect(contextData, "contextData on login page").toBeTruthy();

      // 2. PowerSchool DES-encodes the password client-side. Some installs accept the raw
      // password under the field "pw" and let the server fall back to a plain compare when
      // dbpw is empty. We send both forms (raw + dbpw=raw) so the server is happy either way.
      const form = new URLSearchParams({
        pstoken: pstoken!,
        contextData: contextData!,
        dbpw: password!,
        translator_username: "",
        translator_password: "",
        translator_ldappassword: "",
        returnUrl: "",
        serviceName: "PS Parent Portal",
        serviceTicket: "",
        pcasServerUrl: "/",
        credentialType: "User Id and Password Credential",
        account: username!,
        pw: password!,
        ldappassword: "",
      });

      const ctrl2 = new AbortController();
      const t2 = setTimeout(() => ctrl2.abort(), TIMEOUT_MS);
      const loginRes = await fetch(`${BASE}/guardian/home.html`, {
        method: "POST",
        redirect: "manual",
        signal: ctrl2.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 ReaganDashboard/1.0",
          Cookie: cookies1,
          Origin: BASE,
          Referer: `${BASE}/public/home.html`,
        },
        body: form.toString(),
      });
      clearTimeout(t2);

      const setCookie = loginRes.headers.getSetCookie?.() ?? [];
      const location = loginRes.headers.get("location") ?? "";
      const status = loginRes.status;

      // PowerSchool returns 302 to /guardian/home.html on success, or back to
      // /public/home.html?account=bad on failure.
      const success =
        (status === 302 || status === 303) &&
        /guardian\/home\.html|guardian\/myschedule|guardian\/myaccount/i.test(location) &&
        setCookie.some((c) => /JSESSIONID|s_id|powerschool/i.test(c));

      const looksBad = /account=bad|home\.html\?translator_username/i.test(location);

      if (!success) {
        // Try a follow-up GET if PowerSchool 200s the response with embedded JS redirect.
        if (status === 200) {
          const body = await loginRes.text();
          const indicatesGood =
            /guardian\/home\.html|"\/guardian"|Sign Out/i.test(body) &&
            !/Whoops|incorrect|Invalid Username|Invalid Password/i.test(body);
          if (indicatesGood) return;
        }
        throw new Error(
          `PowerSchool login appeared to fail. status=${status} location="${location}" looksBad=${looksBad}. ` +
            `If this persists, the stored POWERSCHOOL_PARENT_USERNAME / POWERSCHOOL_PARENT_PASSWORD are likely wrong.`,
        );
      }
    },
    TIMEOUT_MS + 5_000,
  );
});
