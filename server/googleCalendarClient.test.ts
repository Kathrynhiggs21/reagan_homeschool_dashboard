import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import { GoogleCalendarClient } from "./_lib/googleCalendarClient";
import {
  resolveCalendarAccessToken,
  isPlausibleBareOAuthToken,
} from "./_lib/googleCalendarAuth";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GoogleCalendarClient", () => {
  it("listEvents passes the privateExtendedProperty filter and returns items", async () => {
    const calls: string[] = [];
    const fakeFetch = vi.fn(async (url: string) => {
      calls.push(url);
      return jsonResponse({ items: [{ id: "e1", summary: "x" }] });
    });
    const client = new GoogleCalendarClient("tok", fakeFetch as unknown as typeof fetch);
    const items = await client.listEvents({
      calendarId: "primary",
      timeMin: "2026-06-19T00:00:00-04:00",
      timeMax: "2026-06-19T23:59:00-04:00",
      privateExtendedProperty: "reaganHomeschoolSync=1",
    });
    expect(items).toHaveLength(1);
    expect(calls[0]).toContain("privateExtendedProperty=reaganHomeschoolSync%3D1");
    expect(calls[0]).toContain("/calendars/primary/events");
  });

  it("insertEvent POSTs the event body and returns the created resource", async () => {
    const fakeFetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      const parsed = JSON.parse(init.body as string);
      expect(parsed.summary).toBe("[Reagan Homeschool] Test");
      return jsonResponse({ id: "new-id", ...parsed });
    });
    const client = new GoogleCalendarClient("tok", fakeFetch as unknown as typeof fetch);
    const created = await client.insertEvent("primary", { summary: "[Reagan Homeschool] Test" });
    expect(created.id).toBe("new-id");
  });

  it("deleteEvent issues a DELETE and tolerates a 204 empty body", async () => {
    const fakeFetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("DELETE");
      return new Response(null, { status: 204 });
    });
    const client = new GoogleCalendarClient("tok", fakeFetch as unknown as typeof fetch);
    await expect(client.deleteEvent("primary", "e1")).resolves.toBeUndefined();
  });

  it("throws a useful error on a non-2xx response", async () => {
    const fakeFetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Invalid Credentials" } }, 401),
    );
    const client = new GoogleCalendarClient("tok", fakeFetch as unknown as typeof fetch);
    await expect(
      client.insertEvent("primary", { summary: "x" }),
    ).rejects.toThrow(/Invalid Credentials/);
  });
});

describe("resolveCalendarAccessToken", () => {
  const KEYS = [
    "GOOGLE_CALENDAR_OAUTH_TOKEN",
    "GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON",
    "GOOGLE_DRIVE_OAUTH_TOKEN",
  ];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  // A realistic-length bare access token (ya29.* tokens are 100+ chars).
  const LONG_BARE = "ya29." + "A".repeat(120);

  it("returns a plausible bare OAuth token verbatim (no network)", async () => {
    process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = LONG_BARE;
    const fakeFetch = vi.fn();
    const { accessToken, source } = await resolveCalendarAccessToken(
      fakeFetch as unknown as typeof fetch,
    );
    expect(accessToken).toBe(LONG_BARE);
    expect(source).toBe("oauth_token_bare");
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("ignores an implausibly-short bare OAuth token and falls through to the service account", async () => {
    // 40-char placeholder that Google rejects with 401 — must NOT shadow the SA.
    process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = "x".repeat(40);
    // Generate a real RSA key so the JWT-bearer assertion can actually sign.
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "sa@example.iam.gserviceaccount.com",
      private_key: privateKey,
    });
    // The SA path tries to mint a token; stub fetch to return one so we can
    // assert the resolver chose the service account rather than the bad token.
    const fakeFetch = vi.fn(async () => jsonResponse({ access_token: "ya29.sa-minted" }));
    const { accessToken, source } = await resolveCalendarAccessToken(
      fakeFetch as unknown as typeof fetch,
    );
    expect(source).toBe("service_account");
    expect(accessToken).toBe("ya29.sa-minted");
  });

  it("throws (no usable cred) when the only OAuth token is an implausible placeholder and no SA is set", async () => {
    process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = "short-placeholder";
    await expect(
      resolveCalendarAccessToken((async () => jsonResponse({})) as unknown as typeof fetch),
    ).rejects.toThrow(/No Calendar credentials configured/);
  });

  describe("isPlausibleBareOAuthToken", () => {
    it("rejects empty / short / whitespace-bearing strings", () => {
      expect(isPlausibleBareOAuthToken("")).toBe(false);
      expect(isPlausibleBareOAuthToken("x".repeat(40))).toBe(false);
      expect(isPlausibleBareOAuthToken("ya29 has a space " + "a".repeat(80))).toBe(false);
    });
    it("accepts a long whitespace-free token", () => {
      expect(isPlausibleBareOAuthToken("ya29." + "A".repeat(120))).toBe(true);
    });
  });

  it("extracts access_token from a JSON blob without refresh data", async () => {
    process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = JSON.stringify({ access_token: "ya29.json-token" });
    const fakeFetch = vi.fn();
    const { accessToken, source } = await resolveCalendarAccessToken(
      fakeFetch as unknown as typeof fetch,
    );
    expect(accessToken).toBe("ya29.json-token");
    expect(source).toBe("oauth_token_json");
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("refreshes when a refresh_token + client creds are present", async () => {
    process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = JSON.stringify({
      refresh_token: "1//refresh",
      client_id: "cid",
      client_secret: "secret",
    });
    const fakeFetch = vi.fn(async () => jsonResponse({ access_token: "ya29.refreshed" }));
    const { accessToken, source } = await resolveCalendarAccessToken(
      fakeFetch as unknown as typeof fetch,
    );
    expect(accessToken).toBe("ya29.refreshed");
    expect(source).toBe("oauth_refresh");
    expect(fakeFetch).toHaveBeenCalledOnce();
  });

  it("falls back to the unified Drive OAuth token", async () => {
    const driveTok = "ya29.drive-unified-" + "B".repeat(80);
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = driveTok;
    const { accessToken } = await resolveCalendarAccessToken(
      (async () => jsonResponse({})) as unknown as typeof fetch,
    );
    expect(accessToken).toBe(driveTok);
  });

  it("throws a clear error when nothing is configured", async () => {
    await expect(
      resolveCalendarAccessToken((async () => jsonResponse({})) as unknown as typeof fetch),
    ).rejects.toThrow(/No Calendar credentials configured/);
  });
});
