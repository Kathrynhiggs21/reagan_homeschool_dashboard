import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GoogleCalendarClient } from "./_lib/googleCalendarClient";
import { resolveCalendarAccessToken } from "./_lib/googleCalendarAuth";

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

  it("returns a bare OAuth token verbatim (no network)", async () => {
    process.env.GOOGLE_CALENDAR_OAUTH_TOKEN = "ya29.bare-token";
    const fakeFetch = vi.fn();
    const { accessToken, source } = await resolveCalendarAccessToken(
      fakeFetch as unknown as typeof fetch,
    );
    expect(accessToken).toBe("ya29.bare-token");
    expect(source).toBe("oauth_token_bare");
    expect(fakeFetch).not.toHaveBeenCalled();
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
    process.env.GOOGLE_DRIVE_OAUTH_TOKEN = "ya29.drive-unified";
    const { accessToken } = await resolveCalendarAccessToken(
      (async () => jsonResponse({})) as unknown as typeof fetch,
    );
    expect(accessToken).toBe("ya29.drive-unified");
  });

  it("throws a clear error when nothing is configured", async () => {
    await expect(
      resolveCalendarAccessToken((async () => jsonResponse({})) as unknown as typeof fetch),
    ).rejects.toThrow(/No Calendar credentials configured/);
  });
});
